import { db } from '@/db/database';
import type { DictionaryEntry, UsageDetails } from '@/types';
import {
  containsHanzi,
  numberedPinyinToMarks,
  removeVietnameseDiacritics,
  stripPinyinCompact,
  stripPinyinTones
} from '@/utils/pinyin';

export interface DictionarySearchFilters {
  query?: string;
  hskLevel?: number; // 1..6 (HSK 2.0) or 1..9 (HSK 3.0)
  hskStandard?: 'hsk2' | 'hsk3';
  radical?: string;
  strokesCount?: number;
  limit?: number;
}

let ramCache: DictionaryEntry[] | null = null;
let ramCacheCount = 0;

export function invalidateDictionaryCache(): void {
  ramCache = null;
  ramCacheCount = 0;
}

async function getAllCached(): Promise<DictionaryEntry[]> {
  const count = await db.dictionary.count();
  if (ramCache && ramCacheCount === count) {
    return ramCache;
  }
  const all = await db.dictionary.toArray();
  ramCache = all;
  ramCacheCount = all.length;
  return all;
}

/**
 * Tìm kiếm từ điển siêu tốc (<50ms):
 * - Chữ Hán (khớp chính xác, bắt đầu bằng, chứa)
 * - Pinyin có dấu ("nǐ hǎo"), không dấu ("ni hao"), không cách ("nihao"), có số thanh ("ni3hao3")
 * - Âm Hán-Việt & nghĩa tiếng Việt (có dấu hoặc không dấu)
 * - Bộ lọc kết hợp HSK 1–6 / HSK 3.0, 214 bộ thủ & số nét
 */
export async function searchDictionary(
  filters: DictionarySearchFilters
): Promise<DictionaryEntry[]> {
  const limit = filters.limit ?? 60;
  const rawQuery = (filters.query || '').trim();
  const entries = await getAllCached();

  const matchesFilter = (entry: DictionaryEntry): boolean => {
    if (filters.hskLevel && filters.hskLevel > 0) {
      if (filters.hskStandard === 'hsk3') {
        if ((entry.hsk3Level || entry.hskLevel) !== filters.hskLevel) return false;
      } else {
        if (entry.hskLevel !== filters.hskLevel) return false;
      }
    }
    if (filters.radical && entry.radical !== filters.radical) {
      return false;
    }
    if (filters.strokesCount && filters.strokesCount > 0) {
      if (entry.strokesCount !== filters.strokesCount) return false;
    }
    return true;
  };

  if (!rawQuery) {
    return entries
      .filter(matchesFilter)
      .sort((a, b) => a.frequency - b.frequency)
      .slice(0, limit);
  }

  const lower = rawQuery.toLowerCase();
  const hasHanzi = containsHanzi(rawQuery);
  const hasToneNumber = /[a-z][1-5]/i.test(rawQuery);
  const qCompactPinyin = stripPinyinCompact(rawQuery);
  const qNoTone = stripPinyinTones(rawQuery);
  const qMarked = hasToneNumber ? numberedPinyinToMarks(lower) : lower;
  const qViNorm = removeVietnameseDiacritics(rawQuery);

  const scored: Array<{ entry: DictionaryEntry; score: number }> = [];

  for (const entry of entries) {
    if (!matchesFilter(entry)) continue;

    let score = 0;

    if (hasHanzi) {
      if (entry.simplified === rawQuery) score = 1000;
      else if (entry.simplified.startsWith(rawQuery)) score = 700 - entry.simplified.length * 10;
      else if (entry.simplified.includes(rawQuery)) score = 400 - entry.simplified.length * 5;
    } else {
      const pyLower = entry.pinyin.toLowerCase();
      const pyNoTone = entry.pinyinNoTone.toLowerCase();
      const pyCompact = pyNoTone.replace(/[^a-z]/g, '');
      const pyNum = (entry.pinyinNumbered || '').toLowerCase();
      const hvNorm = removeVietnameseDiacritics(entry.hanViet);

      if (hasToneNumber && (pyNum === lower.replace(/\s+/g, '') || pyLower === qMarked)) {
        score = 950;
      } else if (pyLower === lower || pyNoTone === qNoTone || (qCompactPinyin && pyCompact === qCompactPinyin)) {
        score = 900;
      } else if (hvNorm === qViNorm) {
        score = 860;
      } else if (
        pyNoTone.startsWith(qNoTone) ||
        (qCompactPinyin.length >= 2 && pyCompact.startsWith(qCompactPinyin)) ||
        (hasToneNumber && pyNum.startsWith(lower.replace(/\s+/g, '')))
      ) {
        score = 650;
      } else if (hvNorm.includes(qViNorm) && qViNorm.length >= 2) {
        score = 540;
      } else {
        // Kiểm tra nghĩa tiếng Việt (có dấu & không dấu)
        for (let i = 0; i < entry.meanings.length; i++) {
          const mNorm = removeVietnameseDiacritics(entry.meanings[i]);
          if (mNorm === qViNorm) {
            score = Math.max(score, 820 - i * 20);
          } else if (mNorm.startsWith(qViNorm)) {
            score = Math.max(score, 600 - i * 15);
          } else if (mNorm.includes(qViNorm)) {
            score = Math.max(score, 420 - i * 10);
          }
        }
      }
    }

    if (score > 0) {
      // Ưu tiên từ phổ biến hơn (frequency nhỏ hơn)
      const freqBonus = Math.max(0, 60 - Math.log10(Math.max(1, entry.frequency)) * 12);
      scored.push({ entry, score: score + freqBonus });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}

export async function getWordById(id: string): Promise<DictionaryEntry | undefined> {
  return db.dictionary.get(id);
}

export async function getWordBySimplified(simplified: string): Promise<DictionaryEntry | undefined> {
  return db.dictionary.where('simplified').equals(simplified).first();
}

export function parseUsageDetails(entry: DictionaryEntry): UsageDetails {
  if (entry.usageDetailsJson) {
    try {
      const parsed = JSON.parse(entry.usageDetailsJson) as UsageDetails;
      if (parsed && Array.isArray(parsed.senses)) {
        return parsed;
      }
    } catch {
      // fall through
    }
  }
  return {
    senses: [
      {
        partOfSpeech: 'Từ vựng',
        register: 'trung tính',
        meaningVi: entry.meanings.join('; '),
        grammarPattern: `Dùng "${entry.simplified}" trong câu giao tiếp thông thường`,
        collocations: [],
        examples: []
      }
    ]
  };
}

export async function saveWordUsageDetails(
  wordId: string,
  details: UsageDetails
): Promise<void> {
  const payload: UsageDetails = {
    ...details,
    aiEnriched: true,
    updatedAt: Date.now()
  };
  await db.dictionary.update(wordId, {
    usageDetailsJson: JSON.stringify(payload)
  });
  invalidateDictionaryCache();
}
