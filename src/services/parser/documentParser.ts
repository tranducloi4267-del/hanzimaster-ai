import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { db } from '@/db/database';
import { extractDocumentAI } from '@/services/ai/aiTasks';
import { segmentChineseText } from '@/services/dictionary/tokenizer';
import { useAppStore } from '@/stores/useAppStore';
import type { ExtractedDocSentence, ExtractedDocWord } from '@/types';
import { containsHanzi, isHanziChar } from '@/utils/pinyin';

// Cấu hình worker an toàn cho pdfjs-dist (Vite bundling friendly)
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  // Fallback in non-browser/test environments
}

export interface ParsedDocumentPreview {
  title: string;
  fileType: 'image' | 'pdf' | 'docx' | 'txt' | 'paste';
  rawText: string;
  words: ExtractedDocWord[];
  sentences: ExtractedDocSentence[];
  usedAi: boolean;
}

export async function fileToBase64(file: File | Blob): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const url = String(reader.result || '');
      const comma = url.indexOf(',');
      const mime = file.type || 'image/png';
      resolve({ data: comma >= 0 ? url.slice(comma + 1) : url, mimeType: mime });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readPdfFile(
  file: File
): Promise<{ text: string; scannedPages: Array<{ data: string; mimeType: string }> }> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let fullText = '';
  const maxTextPages = Math.min(pdf.numPages, 12);

  for (let p = 1; p <= maxTextPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const pageStr = tc.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
      .trim();
    if (pageStr) fullText += `${pageStr}\n`;
  }

  // Nếu PDF scan (ít hoặc không có text tiếng Trung) -> render tối đa 3 trang đầu ra PNG gửi Gemini OCR
  const scannedPages: Array<{ data: string; mimeType: string }> = [];
  if (fullText.trim().length < 25 || !containsHanzi(fullText)) {
    const maxRender = Math.min(pdf.numPages, 3);
    for (let p = 1; p <= maxRender; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const comma = dataUrl.indexOf(',');
      scannedPages.push({
        data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
        mimeType: 'image/jpeg'
      });
    }
  }

  return { text: fullText.trim(), scannedPages };
}

async function readDocxFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value.trim();
}

/**
 * Đối chiếu danh sách từ bóc tách với bảng userVocab & dictionary:
 * - 'new' (Mới hoàn toàn) -> tự động tick
 * - 'learning' (Đã lưu nhưng chưa thuộc) -> tự động tick bổ sung ví dụ
 * - 'mastered' (Đã thuộc) -> bỏ tick mặc định
 */
export async function classifyExtractedWords(
  rawWords: Array<{ simplified: string; pinyin: string; hanViet: string; meaningVi: string }>
): Promise<ExtractedDocWord[]> {
  const userVocabAll = await db.userVocab.toArray();
  const vocabBySimp = new Map(userVocabAll.map((v) => [v.simplified, v]));

  const result: ExtractedDocWord[] = [];
  const seen = new Set<string>();

  for (const w of rawWords) {
    const simp = w.simplified.trim();
    if (!simp || !containsHanzi(simp) || seen.has(simp)) continue;
    seen.add(simp);

    const dictHit = await db.dictionary.where('simplified').equals(simp).first();
    const uv = vocabBySimp.get(simp);

    let matchGroup: ExtractedDocWord['matchGroup'] = 'new';
    let selected = true;
    if (uv) {
      if (uv.status === 'mastered') {
        matchGroup = 'mastered';
        selected = false;
      } else {
        matchGroup = 'learning';
        selected = true;
      }
    }

    result.push({
      simplified: simp,
      pinyin: w.pinyin || dictHit?.pinyin || '',
      hanViet: w.hanViet || dictHit?.hanViet || '',
      meaningVi: w.meaningVi || dictHit?.meanings.join('; ') || '',
      wordId: dictHit?.id,
      matchGroup,
      selected
    });
  }

  return result;
}

/**
 * Bóc tách cục bộ Offline không cần mạng: dùng tokenizer Longest-Match + tra trực tiếp IndexedDB.
 */
async function extractOfflineFromText(rawText: string): Promise<{
  words: Array<{ simplified: string; pinyin: string; hanViet: string; meaningVi: string }>;
  sentences: ExtractedDocSentence[];
}> {
  const segs = segmentChineseText(rawText);
  const uniqueTokens = Array.from(
    new Set(segs.filter((s) => s.isHanzi).map((s) => s.text))
  ).slice(0, 60);

  const words: Array<{ simplified: string; pinyin: string; hanViet: string; meaningVi: string }> =
    [];
  for (const tok of uniqueTokens) {
    const hit = await db.dictionary.where('simplified').equals(tok).first();
    if (hit) {
      words.push({
        simplified: hit.simplified,
        pinyin: hit.pinyin,
        hanViet: hit.hanViet,
        meaningVi: hit.meanings.join('; ')
      });
    } else if (tok.length <= 4 && Array.from(tok).every(isHanziChar)) {
      words.push({
        simplified: tok,
        pinyin: '',
        hanViet: '',
        meaningVi: '(Từ ngoài từ điển lõi — có thể chỉnh sửa nghĩa)'
      });
    }
  }

  const rawSents = rawText
    .split(/[。！？!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => containsHanzi(s) && s.length >= 3)
    .slice(0, 20);

  const sentences: ExtractedDocSentence[] = rawSents.map((hanzi) => ({
    hanzi: `${hanzi}。`,
    pinyin: '',
    translationVi: '',
    selected: true
  }));

  return { words, sentences };
}

export async function parseRawInputForExamOrDoc(
  input:
    | { kind: 'paste'; text: string; title?: string }
    | { kind: 'file'; file: File }
    | { kind: 'image-data'; data: string; mimeType: string; title?: string }
): Promise<{
  title: string;
  fileType: 'image' | 'pdf' | 'docx' | 'txt' | 'paste';
  text?: string;
  imagesBase64?: Array<{ data: string; mimeType: string }>;
}> {
  if (input.kind === 'paste') {
    return {
      title: input.title || 'Văn bản dán',
      fileType: 'paste',
      text: input.text.trim()
    };
  }
  if (input.kind === 'image-data') {
    return {
      title: input.title || `Ảnh chụp ${new Date().toLocaleTimeString('vi-VN')}`,
      fileType: 'image',
      imagesBase64: [{ data: input.data, mimeType: input.mimeType }]
    };
  }

  const file = input.file;
  const nameLower = file.name.toLowerCase();
  const baseTitle = file.name.replace(/\.[^.]+$/, '');

  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(nameLower)) {
    const img = await fileToBase64(file);
    return { title: baseTitle, fileType: 'image', imagesBase64: [img] };
  }
  if (nameLower.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfRes = await readPdfFile(file);
    return {
      title: baseTitle,
      fileType: 'pdf',
      text: pdfRes.text || undefined,
      imagesBase64: pdfRes.scannedPages.length > 0 ? pdfRes.scannedPages : undefined
    };
  }
  if (nameLower.endsWith('.docx')) {
    const text = await readDocxFile(file);
    return { title: baseTitle, fileType: 'docx', text };
  }
  const text = await file.text();
  return { title: baseTitle, fileType: 'txt', text };
}

export async function ingestDocumentToPreview(
  input:
    | { kind: 'paste'; text: string; title?: string }
    | { kind: 'file'; file: File }
    | { kind: 'image-data'; data: string; mimeType: string; title?: string }
): Promise<ParsedDocumentPreview> {
  const prepared = await parseRawInputForExamOrDoc(input);
  const { isOnline, settings } = useAppStore.getState();

  const canUseAi = isOnline && Boolean(settings.geminiApiKey.trim());

  if (canUseAi) {
    const aiOut = await extractDocumentAI({
      text: prepared.text,
      imagesBase64: prepared.imagesBase64
    });
    const classified = await classifyExtractedWords(aiOut.words);
    return {
      title: aiOut.detectedTitle || prepared.title,
      fileType: prepared.fileType,
      rawText: aiOut.rawText || prepared.text || '',
      words: classified,
      sentences: aiOut.sentences.map((s) => ({ ...s, selected: true })),
      usedAi: true
    };
  }

  // Offline fallback
  if (!prepared.text && prepared.imagesBase64?.length) {
    throw new Error(
      'OCR hình ảnh hoặc PDF scan cần kết nối mạng và Gemini API Key miễn phí. Với file chữ (.docx, .txt, PDF văn bản) hoặc dán text, bạn vẫn dùng được 100% Offline!'
    );
  }

  const rawText = prepared.text || '';
  const offlineRes = await extractOfflineFromText(rawText);
  const classified = await classifyExtractedWords(offlineRes.words);

  return {
    title: prepared.title,
    fileType: prepared.fileType,
    rawText,
    words: classified,
    sentences: offlineRes.sentences,
    usedAi: false
  };
}
