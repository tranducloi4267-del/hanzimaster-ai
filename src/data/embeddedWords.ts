import { HSK1_WORDS, type CompactWordTuple } from './hsk1Words';
import { HSK2_WORDS } from './hsk2Words';
import { HSK3_WORDS } from './hsk3Words';
import { RICH_USAGE_OVERRIDES } from './richUsageOverrides';
import { CONFUSABLE_MAP } from './confusables';
import type { DictionaryEntry, UsageDetails } from '@/types';
import {
  buildSearchTokens,
  isHanziChar,
  pinyinToNumbered,
  stripPinyinTones
} from '@/utils/pinyin';

function tupleToDictionaryEntry(tuple: CompactWordTuple, freqIndex: number): DictionaryEntry {
  const [
    simplified,
    pinyin,
    hanViet,
    meaningsRaw,
    hskLevel,
    hsk3Level,
    strokesCount,
    radical,
    pos,
    collocationsRaw,
    exHanzi,
    exPinyin,
    exLiteralVi,
    exVi
  ] = tuple;

  const meanings = meaningsRaw
    .split(/[;；]/)
    .map((m) => m.trim())
    .filter(Boolean);

  const collocations = collocationsRaw
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);

  const pinyinNoTone = stripPinyinTones(pinyin);
  const pinyinNumbered = pinyinToNumbered(pinyin);

  const override = RICH_USAGE_OVERRIDES[simplified];
  const defaultUsage: UsageDetails = {
    senses: [
      {
        partOfSpeech: pos,
        register: 'trung tính',
        meaningVi: meanings.join('; '),
        grammarPattern:
          pos.includes('Động từ')
            ? `Chủ ngữ + ${simplified} + Tân ngữ`
            : pos.includes('Tính từ')
              ? `Chủ ngữ + 很/非常 + ${simplified}`
              : pos.includes('Lượng từ')
                ? `Số từ / 这 / 那 + ${simplified} + Danh từ`
                : `Dùng "${simplified}" trong ngữ cảnh ${pos.toLowerCase()}`,
        collocations,
        examples: [
          {
            hanzi: exHanzi,
            pinyin: exPinyin,
            literalVi: exLiteralVi,
            translationVi: exVi
          }
        ]
      }
    ]
  };

  const usageDetails = override || defaultUsage;

  // Attach known confusables for single-character or matching words
  const confusables = new Set<string>();
  for (const ch of simplified) {
    const group = CONFUSABLE_MAP.get(ch);
    if (group) {
      for (const c of group) confusables.add(c);
    }
  }

  return {
    id: `w_${simplified}_${pinyinNoTone.replace(/\s+/g, '')}`,
    simplified,
    pinyin,
    pinyinNoTone,
    pinyinNumbered,
    hanViet,
    meanings,
    hskLevel,
    hsk3Level,
    frequency: freqIndex + 1,
    strokesCount,
    radical,
    confusables: confusables.size > 0 ? Array.from(confusables) : undefined,
    usageDetailsJson: JSON.stringify(usageDetails),
    searchTokens: buildSearchTokens({
      simplified,
      pinyin,
      pinyinNoTone,
      hanViet,
      meanings
    })
  };
}

let cachedEntries: DictionaryEntry[] | null = null;

/**
 * Xây dựng bộ từ điển lõi nhúng sẵn (520+ mục từ HSK 1–3 chuẩn 100% tiếng Việt)
 * kèm tự động trích xuất từ đơn thành phần cho mọi chữ Hán xuất hiện trong từ ghép
 * để Tap-to-Lookup từng chữ đơn luôn trả về dữ liệu tiếng Việt chuẩn.
 */
export function getEmbeddedDictionaryEntries(): DictionaryEntry[] {
  if (cachedEntries) return cachedEntries;

  const rawTuples: CompactWordTuple[] = [...HSK1_WORDS, ...HSK2_WORDS, ...HSK3_WORDS];
  const seenKey = new Set<string>();
  const entries: DictionaryEntry[] = [];

  for (const tuple of rawTuples) {
    const key = `${tuple[0]}|${stripPinyinTones(tuple[1])}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    entries.push(tupleToDictionaryEntry(tuple, entries.length));
  }

  // Bổ sung các chữ đơn xuất hiện trong các từ ghép mà chưa có mục từ đơn riêng
  const existingSingles = new Set(
    entries.filter((e) => e.simplified.length === 1).map((e) => e.simplified)
  );

  for (const e of [...entries]) {
    if (e.simplified.length < 2) continue;
    const chars = Array.from(e.simplified).filter(isHanziChar);
    const hvParts = e.hanViet.split(/\s+/);
    // Split multi-syllable pinyin greedily if space-separated
    const pyParts = e.pinyin.split(/\s+/);

    chars.forEach((ch, idx) => {
      if (existingSingles.has(ch)) return;
      existingSingles.add(ch);
      const hv = hvParts.length === chars.length ? hvParts[idx] : e.hanViet;
      const py = pyParts.length === chars.length ? pyParts[idx] : e.pinyin;
      const pyNoTone = stripPinyinTones(py);
      const meaning = `Chữ đơn trong "${e.simplified}" (${e.meanings[0]})`;

      const usage: UsageDetails = {
        senses: [
          {
            partOfSpeech: 'Chữ đơn / Yếu tố ghép từ',
            register: 'trung tính',
            meaningVi: meaning,
            grammarPattern: `Thường xuất hiện trong từ ghép như ${e.simplified}`,
            collocations: [e.simplified],
            examples: (() => {
              try {
                const parsed = JSON.parse(e.usageDetailsJson || '{}') as UsageDetails;
                return parsed.senses?.[0]?.examples || [];
              } catch {
                return [];
              }
            })()
          }
        ]
      };

      const confusables = CONFUSABLE_MAP.get(ch);
      entries.push({
        id: `w_char_${ch}`,
        simplified: ch,
        pinyin: py,
        pinyinNoTone: pyNoTone,
        pinyinNumbered: pinyinToNumbered(py),
        hanViet: hv,
        meanings: [meaning],
        hskLevel: e.hskLevel,
        hsk3Level: e.hsk3Level,
        frequency: 1000 + entries.length,
        strokesCount: e.strokesCount,
        radical: e.radical,
        confusables,
        usageDetailsJson: JSON.stringify(usage),
        searchTokens: buildSearchTokens({
          simplified: ch,
          pinyin: py,
          pinyinNoTone: pyNoTone,
          hanViet: hv,
          meanings: [meaning, e.simplified]
        })
      });
    });
  }

  cachedEntries = entries;
  return entries;
}
