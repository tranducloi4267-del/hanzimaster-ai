import { db } from '@/db/database';
import { parseUsageDetails } from '@/services/dictionary/dictionaryService';
import type { DictionaryEntry, LessonContent } from '@/types';

export type ArcadeSourceType = 'fsrs-due' | 'hsk' | 'lesson' | 'leech';

export interface ArcadeSentence {
  hanzi: string;
  pinyin: string;
  translationVi: string;
  targetWord: DictionaryEntry;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function loadArcadeDeck(params: {
  source: ArcadeSourceType;
  hskLevel?: number;
  hskStandard?: 'hsk2' | 'hsk3';
  lessonId?: string;
  limit?: number;
}): Promise<{ words: DictionaryEntry[]; sentences: ArcadeSentence[]; sourceLabel: string }> {
  const limit = params.limit ?? 20;
  let words: DictionaryEntry[] = [];
  const sentences: ArcadeSentence[] = [];
  let sourceLabel = 'Kho từ vựng';

  if (params.source === 'leech') {
    sourceLabel = 'Phòng cấp cứu từ khó (Tử huyệt)';
    const leeches = await db.userVocab.filter((v) => v.isLeech).limit(limit).toArray();
    for (const uv of leeches) {
      const w = await db.dictionary.get(uv.wordId);
      if (w) words.push(w);
    }
  } else if (params.source === 'fsrs-due') {
    sourceLabel = 'Từ đến hạn ôn FSRS';
    const now = Date.now();
    const due = await db.userVocab
      .where('nextReviewAt')
      .belowOrEqual(now)
      .limit(limit)
      .toArray();
    for (const uv of due) {
      const w = await db.dictionary.get(uv.wordId);
      if (w) words.push(w);
    }
    if (words.length < 6) {
      const learning = await db.userVocab.limit(limit).toArray();
      for (const uv of learning) {
        if (!words.some((w) => w.id === uv.wordId)) {
          const w = await db.dictionary.get(uv.wordId);
          if (w) words.push(w);
        }
      }
    }
  } else if (params.source === 'lesson' && params.lessonId) {
    const lesson = await db.lessons.get(params.lessonId);
    if (lesson) {
      sourceLabel = `Bài học: ${lesson.title}`;
      for (const tw of lesson.targetWords) {
        const found = await db.dictionary.where('simplified').equals(tw).first();
        if (found) words.push(found);
      }
      try {
        const content = JSON.parse(lesson.contentJson) as LessonContent;
        for (const line of content.lines || []) {
          const matchedWord = words.find((w) => line.hanzi.includes(w.simplified));
          if (matchedWord) {
            sentences.push({
              hanzi: line.hanzi,
              pinyin: line.pinyin,
              translationVi: line.translationVi,
              targetWord: matchedWord
            });
          }
        }
      } catch {
        // ignore
      }
    }
  } else if (params.source === 'hsk') {
    const lv = params.hskLevel || 1;
    sourceLabel =
      params.hskStandard === 'hsk3' ? `HSK 3.0 · Cấp ${lv}` : `Chuẩn HSK ${lv}`;
    const all = await db.dictionary.toArray();
    const filtered = all.filter((w) =>
      params.hskStandard === 'hsk3' ? (w.hsk3Level || w.hskLevel) === lv : w.hskLevel === lv
    );
    words = shuffleArray(filtered.length > 0 ? filtered : all).slice(0, limit);
  }

  // Fallback nhẹ để trò chơi luôn có đủ câu hỏi nếu người dùng mới chưa có từ đến hạn/tử huyệt
  if (words.length < 6) {
    const extra = await db.dictionary.orderBy('frequency').limit(40).toArray();
    for (const w of shuffleArray(extra)) {
      if (words.length >= Math.min(limit, 14)) break;
      if (!words.some((x) => x.id === w.id)) {
        words.push(w);
      }
    }
  }

  // Bổ sung câu mẫu từ usageDetails của từng từ
  for (const w of words) {
    const details = parseUsageDetails(w);
    const ex = details.senses?.[0]?.examples?.[0];
    if (ex && ex.hanzi.includes(w.simplified)) {
      sentences.push({
        hanzi: ex.hanzi,
        pinyin: ex.pinyin,
        translationVi: ex.translationVi,
        targetWord: w
      });
    }
  }

  return {
    words: shuffleArray(words),
    sentences: shuffleArray(sentences),
    sourceLabel
  };
}
