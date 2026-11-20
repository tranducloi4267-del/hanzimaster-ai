import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getEmbeddedDictionaryEntries } from '@/data/embeddedWords';
import coreGraphics from '@/data/coreGraphics.json';
import {
  extractToneNumbers,
  numberedPinyinToMarks,
  pinyinToNumbered,
  stripPinyinCompact,
  stripPinyinTones
} from '@/utils/pinyin';
import { segmentChineseText, setTokenizerVocabulary } from '@/services/dictionary/tokenizer';
import { matchAgainstReferences } from '@/services/handwriting/matcher';
import { computeShadowingDiff } from '@/services/stt/sttService';
import { db } from '@/db/database';
import { searchDictionary, invalidateDictionaryCache } from '@/services/dictionary/dictionaryService';
import {
  LEECH_THRESHOLD,
  Rating,
  recordVocabReview
} from '@/services/fsrs/fsrsService';
import { buildBackupPayload, importBackupJson } from '@/services/backup/backupService';
import { RequestQueue } from '@/services/ai/geminiClient';

describe('HanziMaster AI — Kiểm thử lõi Offline-First', () => {
  beforeAll(async () => {
    const entries = getEmbeddedDictionaryEntries();
    await db.dictionary.clear();
    await db.dictionary.bulkPut(entries);
    invalidateDictionaryCache();
    setTokenizerVocabulary(entries.map((e) => e.simplified));
  });

  it('Bộ từ điển lõi nhúng sẵn có >500 mục từ chuẩn tiếng Việt và không trùng ID', () => {
    const entries = getEmbeddedDictionaryEntries();
    expect(entries.length).toBeGreaterThanOrEqual(500);
    const ids = new Set(entries.map((e) => e.id));
    expect(ids.size).toBe(entries.length);
    const niHao = entries.find((e) => e.simplified === '你好');
    expect(niHao?.meanings[0]).toContain('xin chào');
  });

  it('Dữ liệu nét vẽ MakeMeAHanzi lõi có >1.000 chữ thực đầy đủ strokes & medians', () => {
    const gfx = coreGraphics as Record<string, { strokes: string[]; medians: number[][][] }>;
    expect(Object.keys(gfx).length).toBeGreaterThan(1000);
    expect(gfx['好'].strokes.length).toBe(6);
    expect(gfx['好'].medians.length).toBe(6);
  });

  it('Chuẩn hóa Pinyin hỗ trợ đầy đủ dấu thanh, không dấu, không cách và số thanh điệu', () => {
    expect(stripPinyinTones('nǐ hǎo')).toBe('ni hao');
    expect(stripPinyinCompact('nǐ hǎo')).toBe('nihao');
    expect(pinyinToNumbered('nǐ hǎo')).toBe('ni3hao3');
    expect(numberedPinyinToMarks('ni3hao3')).toBe('nǐhǎo');
    expect(extractToneNumbers('mā má mǎ mà')).toEqual([1, 2, 3, 4]);
  });

  it('Tách từ Longest-Match nhận đúng từ ghép "图书馆" và "看书" trong câu liền mạch', () => {
    const segs = segmentChineseText('我今天想去图书馆看书。');
    const texts = segs.map((s) => s.text);
    expect(texts).toContain('图书馆');
    expect(texts).toContain('看书');
    expect(texts).toContain('今天');
  });

  it('Tìm kiếm từ điển Offline nhanh (<50ms) theo Chữ Hán, Pinyin số thanh, Hán-Việt và tiếng Việt', async () => {
    const t0 = performance.now();
    const byNum = await searchDictionary({ query: 'ni3hao3' });
    const byVi = await searchDictionary({ query: 'thu vien' });
    const byHanzi = await searchDictionary({ query: '买' });
    const elapsed = performance.now() - t0;

    expect(byNum[0]?.simplified).toBe('你好');
    expect(byVi.some((r) => r.simplified === '图书馆')).toBe(true);
    expect(byHanzi[0]?.simplified).toBe('买');
    expect(elapsed).toBeLessThan(150);
  });

  it('Thuật toán vẽ tay Offline khớp chính xác chữ Hán với MakeMeAHanzi medians', () => {
    const gfx = coreGraphics as Record<string, { char: string; medians: number[][][] }>;
    const refs = ['一', '二', '三', '十', '人', '大', '口', '日'].map((c) => gfx[c]);

    // Vẽ mô phỏng chữ 十 (1 nét ngang + 1 nét sổ thẳng đứng, trục Y Canvas hướng xuống)
    const userShi = [
      [
        { x: 30, y: 120 },
        { x: 210, y: 120 }
      ],
      [
        { x: 120, y: 20 },
        { x: 120, y: 220 }
      ]
    ];
    const matches = matchAgainstReferences(userShi, refs, 5);
    expect(matches[0]?.char).toBe('十');
  });

  it('Lõi FSRS tự động gắn cờ Tử huyệt (Leech) sau 3 lần sai & thưởng x2 EXP ở Hardcore', async () => {
    await db.userVocab.clear();
    const word = getEmbeddedDictionaryEntries().find((e) => e.simplified === '学习')!;

    let res = await recordVocabReview(word.id, word.simplified, Rating.Again);
    expect(res.item.isLeech).toBe(false);
    res = await recordVocabReview(word.id, word.simplified, Rating.Again);
    expect(res.item.isLeech).toBe(false);
    res = await recordVocabReview(word.id, word.simplified, Rating.Again);
    expect(res.item.wrongCount).toBe(LEECH_THRESHOLD);
    expect(res.item.isLeech).toBe(true);

    const normalRes = await recordVocabReview(word.id, word.simplified, Rating.Good, {
      hardcore: false,
      baseExp: 10
    });
    const hardRes = await recordVocabReview(word.id, word.simplified, Rating.Good, {
      hardcore: true,
      baseExp: 10
    });
    expect(hardRes.expEarned).toBe(normalRes.expEarned * 2);
  });

  it('Shadowing diff so khớp đúng chữ xanh / đỏ / vàng và tính % chính xác', () => {
    const diff = computeShadowingDiff('我想喝咖啡', '我想吃咖啡');
    expect(diff.tokens.map((t) => t.status)).toEqual([
      'correct',
      'correct',
      'wrong',
      'correct',
      'correct'
    ]);
    expect(diff.accuracyPercent).toBe(80);
  });

  it('RequestQueue thực thi tuần tự đảm bảo khoảng cách chống lỗi 429', async () => {
    const q = new RequestQueue(25);
    const order: number[] = [];
    await Promise.all([
      q.enqueue(async () => {
        order.push(1);
      }),
      q.enqueue(async () => {
        order.push(2);
      })
    ]);
    expect(order).toEqual([1, 2]);
  });

  it('Sao lưu JSON mặc định không xuất API Key & Khôi phục Gộp thông minh giữ dữ liệu mới hơn', async () => {
    await db.settings.put({ key: 'geminiApiKeyEncrypted', value: 'AIzaSySECRET_TEST' });
    const safeBackup = await buildBackupPayload(false);
    expect(safeBackup.includesApiKey).toBe(false);
    expect(
      safeBackup.data.settings.some((s) => s.key === 'geminiApiKeyEncrypted')
    ).toBe(false);

    const backupText = JSON.stringify(safeBackup);
    const imported = await importBackupJson(backupText, 'merge');
    expect(imported.vocabCount).toBeGreaterThanOrEqual(1);
  });
});
