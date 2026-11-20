import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import {
  Camera as CameraIcon,
  CheckCircle2,
  FileText,
  FolderOpen,
  Gamepad2,
  Loader2,
  Save,
  Trash2,
  Upload,
  Volume2
} from 'lucide-react';
import { db } from '@/db/database';
import {
  ingestDocumentToPreview,
  type ParsedDocumentPreview
} from '@/services/parser/documentParser';
import { addOrGetUserVocab } from '@/services/fsrs/fsrsService';
import { invalidateDictionaryCache } from '@/services/dictionary/dictionaryService';
import { addTokenizerWords } from '@/services/dictionary/tokenizer';
import { speakChinese } from '@/services/tts/ttsService';
import { useAppStore } from '@/stores/useAppStore';
import type {
  DictionaryEntry,
  DocumentItem,
  ExtractedDocSentence,
  ExtractedDocWord,
  LessonContent,
  LessonItem
} from '@/types';
import {
  buildSearchTokens,
  createId,
  getTodayDateString,
  pinyinToNumbered,
  stripPinyinTones
} from '@/utils/pinyin';
import { DisplayControlBar } from '@/components/common/DisplayControlBar';
import { InteractiveHanziText } from '@/components/common/InteractiveHanziText';

export const DocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { pushToast, setActiveArcadeLessonId } = useAppStore();

  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ParsedDocumentPreview | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const loadDocs = async () => {
    const all = await db.documents.orderBy('createdAt').reverse().toArray();
    setDocs(all);
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleCameraCapture = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await Camera.getPhoto({
          quality: 85,
          resultType: CameraResultType.Base64,
          source: CameraSource.Prompt,
          promptLabelHeader: 'Nạp ảnh tài liệu tiếng Trung',
          promptLabelPhoto: 'Chọn từ thư viện',
          promptLabelPicture: 'Chụp ảnh trực tiếp'
        });
        if (!photo.base64String) return;
        setLoading(true);
        const res = await ingestDocumentToPreview({
          kind: 'image-data',
          data: photo.base64String,
          mimeType: `image/${photo.format || 'jpeg'}`
        });
        setPreview(res);
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'Không chụp được ảnh', 'error');
      } finally {
        setLoading(false);
      }
      return;
    }
    // Trên PC / Web: mở chọn ảnh / webcam capture
    imageInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLoading(true);
    try {
      const res = await ingestDocumentToPreview({ kind: 'file', file });
      setPreview(res);
      pushToast(
        res.usedAi
          ? `AI đã bóc tách ${res.words.length} từ & ${res.sentences.length} câu mẫu!`
          : `Đã bóc tách cục bộ ${res.words.length} từ (chế độ Offline).`,
        'success'
      );
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi đọc tài liệu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasteExtract = async () => {
    if (!pasteText.trim()) return;
    setLoading(true);
    try {
      const res = await ingestDocumentToPreview({
        kind: 'paste',
        text: pasteText,
        title: pasteTitle.trim() || undefined
      });
      setPreview(res);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi phân tích văn bản', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreviewToLibrary = async () => {
    if (!preview) return;
    const chosenWords = preview.words.filter((w) => w.selected);
    const chosenSentences = preview.sentences.filter((s) => s.selected);
    const now = Date.now();
    const addedDictWords: string[] = [];

    // 1. Bổ sung từ mới vào dictionary & userVocab FSRS
    for (const w of chosenWords) {
      let existing = await db.dictionary.where('simplified').equals(w.simplified).first();
      if (!existing) {
        const pyNoTone = stripPinyinTones(w.pinyin);
        const newEntry: DictionaryEntry = {
          id: createId('w_doc'),
          simplified: w.simplified,
          pinyin: w.pinyin || w.simplified,
          pinyinNoTone: pyNoTone,
          pinyinNumbered: pinyinToNumbered(w.pinyin || ''),
          hanViet: w.hanViet || '',
          meanings: w.meaningVi ? [w.meaningVi] : ['Từ trích từ tài liệu'],
          hskLevel: 0,
          frequency: 9000,
          strokesCount: w.simplified.length * 6,
          radical: '',
          searchTokens: buildSearchTokens({
            simplified: w.simplified,
            pinyin: w.pinyin || '',
            pinyinNoTone: pyNoTone,
            hanViet: w.hanViet || '',
            meanings: [w.meaningVi || '']
          })
        };
        await db.dictionary.put(newEntry);
        existing = newEntry;
        addedDictWords.push(w.simplified);
      }
      await addOrGetUserVocab(existing.id, existing.simplified, 'document');
    }

    if (addedDictWords.length > 0) {
      invalidateDictionaryCache();
      addTokenizerWords(addedDictWords);
    }

    // 2. Tạo 1 LessonItem độc lập để chơi toàn bộ 7 game Memory Arcade từ tài liệu này!
    const lessonId = createId('lesson_doc');
    const lessonContent: LessonContent = {
      topic: 'Tài liệu tự nạp',
      summaryVi: `Bài học tạo từ tài liệu "${preview.title}" (${chosenWords.length} từ vựng, ${chosenSentences.length} câu mẫu).`,
      lines:
        chosenSentences.length > 0
          ? chosenSentences.map((s) => ({
              hanzi: s.hanzi,
              pinyin: s.pinyin,
              translationVi: s.translationVi
            }))
          : [
              {
                hanzi: preview.rawText.slice(0, 300),
                pinyin: '',
                translationVi: ''
              }
            ],
      grammarPoints: [],
      questions: []
    };

    const lesson: LessonItem = {
      id: lessonId,
      date: getTodayDateString(),
      title: preview.title,
      level: 0,
      contentJson: JSON.stringify(lessonContent),
      targetWords: chosenWords.map((w) => w.simplified),
      sourceType: 'document',
      completed: false,
      createdAt: now
    };
    await db.lessons.put(lesson);

    // 3. Lưu DocumentItem
    const docItem: DocumentItem = {
      id: createId('doc'),
      title: preview.title,
      fileType: preview.fileType,
      rawText: preview.rawText,
      extractedWordsJson: JSON.stringify(chosenWords),
      extractedSentencesJson: JSON.stringify(chosenSentences),
      lessonId,
      createdAt: now
    };
    await db.documents.put(docItem);

    setPreview(null);
    setPasteText('');
    setPasteTitle('');
    await loadDocs();
    setSelectedDoc(docItem);
    pushToast(
      `Đã lưu "${docItem.title}" (+${chosenWords.length} từ vào sổ ôn & sẵn sàng chơi Arcade)!`,
      'success'
    );
  };

  const handleDeleteDoc = async (doc: DocumentItem) => {
    await db.documents.delete(doc.id);
    if (doc.lessonId) await db.lessons.delete(doc.lessonId);
    if (selectedDoc?.id === doc.id) setSelectedDoc(null);
    await loadDocs();
    pushToast('Đã xóa tài liệu khỏi kho.', 'info');
  };

  const renderDocWords = (doc: DocumentItem): ExtractedDocWord[] => {
    try {
      return JSON.parse(doc.extractedWordsJson);
    } catch {
      return [];
    }
  };
  const renderDocSentences = (doc: DocumentItem): ExtractedDocSentence[] => {
    try {
      return JSON.parse(doc.extractedSentencesJson);
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-5">
      <DisplayControlBar compact />

      {/* Khu vực nạp tài liệu 4 nguồn */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand-600" />
            <span>Nạp Tài liệu Thông minh (Chụp ảnh · PDF · DOCX · TXT · Dán văn bản)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tự động OCR, bóc tách từ vựng & câu mẫu, đối chiếu sổ từ của bạn thành 3 nhóm màu trước
            khi lưu.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.csv,image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={handleCameraCapture}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-3 text-xs font-bold shadow-sm transition"
          >
            <CameraIcon className="w-4 h-4" />
            <span>Chụp ảnh / Chọn ảnh sách (Gemini OCR)</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 px-4 py-3 text-xs font-bold transition"
          >
            <FileText className="w-4 h-4 text-brand-500" />
            <span>Tải tệp .PDF / .DOCX / .TXT / .CSV</span>
          </button>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <input
            type="text"
            value={pasteTitle}
            onChange={(e) => setPasteTitle(e.target.value)}
            placeholder="Tiêu đề tài liệu (tùy chọn)..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          />
          <textarea
            rows={3}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Hoặc dán trực tiếp một đoạn báo, lời bài hát, bài khóa tiếng Trung vào đây..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-hanzi text-sm"
          />
          <button
            type="button"
            disabled={loading || !pasteText.trim()}
            onClick={handlePasteExtract}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-xs font-bold disabled:opacity-40"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Phân tích & Bóc tách từ vựng</span>
          </button>
        </div>
      </div>

      {/* Màn hình Xem trước & Duyệt OCR (3 nhóm màu đối chiếu userVocab) */}
      {preview && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-brand-400 dark:border-brand-700 p-4 sm:p-5 shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-brand-700 dark:text-brand-300">
                Xem trước & Duyệt tài liệu trước khi lưu
              </h3>
              <p className="text-xs text-slate-500">
                Chỉnh sửa nhanh lỗi OCR nếu có, chọn lọc các từ/câu muốn đưa vào Kho học & Arcade.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSavePreviewToLibrary}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 text-xs font-bold shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>Lưu vào Kho học</span>
              </button>
            </div>
          </div>

          <input
            type="text"
            value={preview.title}
            onChange={(e) => setPreview({ ...preview, title: e.target.value })}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-bold"
          />

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              Văn bản OCR gốc (có thể sửa trực tiếp):
            </label>
            <textarea
              rows={3}
              value={preview.rawText}
              onChange={(e) => setPreview({ ...preview, rawText: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-hanzi text-sm"
            />
          </div>

          {/* 3 nhóm màu đối chiếu */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <span>Từ vựng bóc tách ({preview.words.length}):</span>
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                ● Mới hoàn toàn (tự tick)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                ● Đã lưu / Chưa thuộc (tự tick)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ● Đã thuộc (bỏ tick)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {preview.words.map((w, idx) => {
                const badgeCls =
                  w.matchGroup === 'new'
                    ? 'border-l-4 border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/20'
                    : w.matchGroup === 'learning'
                      ? 'border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
                      : 'border-l-4 border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 opacity-75';

                return (
                  <div
                    key={idx}
                    className={`rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 flex items-start gap-2 ${badgeCls}`}
                  >
                    <input
                      type="checkbox"
                      checked={w.selected}
                      onChange={(e) => {
                        const copy = [...preview.words];
                        copy[idx] = { ...w, selected: e.target.checked };
                        setPreview({ ...preview, words: copy });
                      }}
                      className="mt-1 rounded text-brand-600"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex gap-1.5">
                        <input
                          value={w.simplified}
                          onChange={(e) => {
                            const copy = [...preview.words];
                            copy[idx] = { ...w, simplified: e.target.value };
                            setPreview({ ...preview, words: copy });
                          }}
                          className="w-24 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 font-hanzi font-bold text-sm"
                        />
                        <input
                          value={w.pinyin}
                          onChange={(e) => {
                            const copy = [...preview.words];
                            copy[idx] = { ...w, pinyin: e.target.value };
                            setPreview({ ...preview, words: copy });
                          }}
                          placeholder="Pinyin"
                          className="flex-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-xs"
                        />
                      </div>
                      <input
                        value={w.meaningVi}
                        onChange={(e) => {
                          const copy = [...preview.words];
                          copy[idx] = { ...w, meaningVi: e.target.value };
                          setPreview({ ...preview, words: copy });
                        }}
                        placeholder="Nghĩa tiếng Việt"
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {preview.sentences.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-500">
                Câu mẫu trích xuất ({preview.sentences.length}):
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {preview.sentences.map((s, idx) => (
                  <label
                    key={idx}
                    className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={s.selected}
                      onChange={(e) => {
                        const copy = [...preview.sentences];
                        copy[idx] = { ...s, selected: e.target.checked };
                        setPreview({ ...preview, sentences: copy });
                      }}
                      className="mt-0.5 rounded text-brand-600"
                    />
                    <div className="flex-1">
                      <div className="font-hanzi text-sm font-semibold">{s.hanzi}</div>
                      {s.translationVi && <div className="text-slate-500">{s.translationVi}</div>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kho tài liệu đã lưu */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-5 space-y-2">
          <h3 className="text-sm font-bold flex items-center gap-1.5 px-1">
            <FolderOpen className="w-4 h-4 text-brand-600" />
            <span>Kho tài liệu của tôi ({docs.length})</span>
          </h3>
          {docs.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500">
              Chưa có tài liệu nào. Hãy nạp ảnh trang sách, file PDF/DOCX hoặc dán văn bản ở trên!
            </div>
          ) : (
            docs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`cursor-pointer rounded-xl border p-3.5 transition flex items-start justify-between gap-2 ${
                  selectedDoc?.id === doc.id
                    ? 'bg-brand-50/70 dark:bg-brand-950/35 border-brand-400'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-brand-300'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{doc.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {doc.fileType.toUpperCase()} · {renderDocWords(doc).length} từ ·{' '}
                    {new Date(doc.createdAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDoc(doc);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  title="Xóa tài liệu"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Chi tiết tài liệu (Tap-to-Lookup, Shadowing, Chơi Arcade) */}
        <div className="lg:col-span-7">
          {selectedDoc ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold">{selectedDoc.title}</h3>
                  <div className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã lưu Offline · Hỗ trợ Tap-to-Lookup &
                    Shadowing
                  </div>
                </div>
                {selectedDoc.lessonId && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveArcadeLessonId(selectedDoc.lessonId!);
                      navigate('/arcade');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 text-xs font-bold"
                  >
                    <Gamepad2 className="w-4 h-4" />
                    <span>Chơi Arcade từ tài liệu này</span>
                  </button>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 p-4">
                <InteractiveHanziText
                  text={selectedDoc.rawText}
                  highlightWords={renderDocWords(selectedDoc).map((w) => w.simplified)}
                  allowShadowing
                />
              </div>

              {renderDocSentences(selectedDoc).length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase text-slate-400">
                    Các câu mẫu trích xuất
                  </div>
                  {renderDocSentences(selectedDoc).map((s, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 flex items-start justify-between gap-2"
                    >
                      <InteractiveHanziText
                        text={s.hanzi}
                        sentencePinyin={s.pinyin}
                        sentenceTranslationVi={s.translationVi}
                        allowShadowing
                      />
                      <button
                        type="button"
                        onClick={() => speakChinese(s.hanzi).catch(() => {})}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-400">
              Chọn một tài liệu bên trái để đọc kèm Tap-to-Lookup, Shadowing và chơi game ôn tập.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
