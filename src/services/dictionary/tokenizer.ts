import { isHanziChar } from '@/utils/pinyin';

export interface TextSegment {
  text: string;
  isHanzi: boolean;
  start: number;
  end: number;
}

const MAX_WORD_LEN = 6;
let wordSet: Set<string> = new Set();

export function setTokenizerVocabulary(words: Iterable<string>): void {
  wordSet = new Set(words);
}

export function addTokenizerWords(words: Iterable<string>): void {
  for (const w of words) {
    if (w) wordSet.add(w);
  }
}

export function getTokenizerVocabSize(): number {
  return wordSet.size;
}

/**
 * Tách câu tiếng Trung siêu nhanh (<2ms) kết hợp:
 * 1. Maximum Forward Matching (Longest-Match) trên kho từ điển IndexedDB.
 * 2. Intl.Segmenter('zh-CN') làm lớp dự phòng cho cụm từ chưa có trong từ điển lõi.
 */
export function segmentChineseText(
  text: string,
  extraHighlightWords?: string[]
): TextSegment[] {
  if (!text) return [];

  const localSet =
    extraHighlightWords && extraHighlightWords.length > 0
      ? new Set([...wordSet, ...extraHighlightWords])
      : wordSet;

  // Pre-compute Intl.Segmenter spans as fallback hints when available
  const intlSpans = new Map<number, number>();
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
      for (const seg of segmenter.segment(text)) {
        if (seg.segment.length > 1 && isHanziChar(seg.segment[0])) {
          intlSpans.set(seg.index, seg.segment.length);
        }
      }
    } catch {
      // Ignore environments without zh-CN Intl.Segmenter
    }
  }

  const result: TextSegment[] = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];
    if (!isHanziChar(ch)) {
      // Group consecutive non-hanzi characters together
      const start = i;
      while (i < len && !isHanziChar(text[i])) {
        i++;
      }
      result.push({
        text: text.slice(start, i),
        isHanzi: false,
        start,
        end: i
      });
      continue;
    }

    // Try Longest-Match in dictionary (length 6 down to 2)
    let matchedLen = 0;
    const maxCheck = Math.min(MAX_WORD_LEN, len - i);
    for (let l = maxCheck; l >= 2; l--) {
      const candidate = text.slice(i, i + l);
      if (localSet.has(candidate)) {
        matchedLen = l;
        break;
      }
    }

    // Fallback to Intl.Segmenter if it recognizes a multi-char Hanzi word
    if (matchedLen === 0) {
      const segLen = intlSpans.get(i);
      if (segLen && segLen >= 2 && segLen <= MAX_WORD_LEN) {
        let allHanzi = true;
        for (let k = 0; k < segLen; k++) {
          if (!isHanziChar(text[i + k])) {
            allHanzi = false;
            break;
          }
        }
        if (allHanzi) {
          matchedLen = segLen;
        }
      }
    }

    if (matchedLen === 0) {
      matchedLen = 1;
    }

    result.push({
      text: text.slice(i, i + matchedLen),
      isHanzi: true,
      start: i,
      end: i + matchedLen
    });
    i += matchedLen;
  }

  return result;
}
