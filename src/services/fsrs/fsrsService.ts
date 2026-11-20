import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade
} from 'ts-fsrs';
import { db } from '@/db/database';
import type {
  DictionaryEntry,
  StudyLogItem,
  UserVocabItem,
  VocabSource,
  VocabStatus
} from '@/types';
import { getTodayDateString } from '@/utils/pinyin';

const scheduler = fsrs(
  generatorParameters({
    enable_fuzz: true,
    maximum_interval: 3650
  })
);

export const LEECH_THRESHOLD = 3;

export function serializeCard(card: Card): string {
  return JSON.stringify(card);
}

export function deserializeCard(json?: string): Card {
  if (!json) return createEmptyCard(new Date());
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    return {
      ...createEmptyCard(new Date()),
      ...raw,
      due: raw.due ? new Date(String(raw.due)) : new Date(),
      last_review: raw.last_review ? new Date(String(raw.last_review)) : undefined
    } as Card;
  } catch {
    return createEmptyCard(new Date());
  }
}

export async function addOrGetUserVocab(
  wordId: string,
  simplified: string,
  source: VocabSource = 'lookup'
): Promise<{ item: UserVocabItem; created: boolean }> {
  const existing = await db.userVocab.where('wordId').equals(wordId).first();
  if (existing) {
    return { item: existing, created: false };
  }
  const now = Date.now();
  const card = createEmptyCard(new Date(now));
  const item: UserVocabItem = {
    id: `uv_${wordId}`,
    wordId,
    simplified,
    status: 'learning',
    fsrsCardJson: serializeCard(card),
    wrongCount: 0,
    reviewCount: 0,
    isLeech: false,
    source,
    addedAt: now,
    nextReviewAt: now,
    updatedAt: now
  };
  await db.userVocab.put(item);
  await recordStudyActivity({ wordsLearned: 1, expEarned: 5 });
  return { item, created: true };
}

export async function toggleUserVocab(
  wordId: string,
  simplified: string,
  source: VocabSource = 'lookup'
): Promise<'added' | 'removed'> {
  const existing = await db.userVocab.where('wordId').equals(wordId).first();
  if (existing) {
    await db.userVocab.delete(existing.id);
    return 'removed';
  }
  await addOrGetUserVocab(wordId, simplified, source);
  return 'added';
}

export async function setVocabStatus(
  wordId: string,
  simplified: string,
  status: VocabStatus,
  source: VocabSource = 'lookup'
): Promise<UserVocabItem> {
  const { item } = await addOrGetUserVocab(wordId, simplified, source);
  const now = Date.now();
  const updated: UserVocabItem = {
    ...item,
    status,
    isLeech: status === 'mastered' ? false : item.isLeech,
    nextReviewAt: status === 'mastered' ? now + 30 * 86400 * 1000 : item.nextReviewAt,
    updatedAt: now
  };
  await db.userVocab.put(updated);
  return updated;
}

export interface ReviewResult {
  item: UserVocabItem;
  expEarned: number;
  becameLeech: boolean;
  nextDueDate: Date;
}

export async function recordVocabReview(
  wordId: string,
  simplified: string,
  grade: Grade,
  options: {
    hardcore?: boolean;
    source?: VocabSource;
    baseExp?: number;
  } = {}
): Promise<ReviewResult> {
  const { item } = await addOrGetUserVocab(wordId, simplified, options.source || 'hsk');
  const now = new Date();
  const prevCard = deserializeCard(item.fsrsCardJson);
  const scheduling = scheduler.repeat(prevCard, now);
  const chosen = scheduling[grade];
  const nextCard: Card = { ...chosen.card };

  const isWrong = grade === Rating.Again;

  // Hardcore mode bonus: tăng độ ổn định FSRS (+15%) và x2 EXP khi trả lời đúng
  if (!isWrong && options.hardcore && nextCard.stability > 0) {
    nextCard.stability = Number((nextCard.stability * 1.15).toFixed(3));
    const bonusDays = Math.max(1, Math.round(nextCard.scheduled_days * 1.15));
    nextCard.scheduled_days = bonusDays;
    nextCard.due = new Date(now.getTime() + bonusDays * 86400 * 1000);
  }

  const wrongCount = isWrong ? item.wrongCount + 1 : item.wrongCount;
  const becameLeech = !item.isLeech && wrongCount >= LEECH_THRESHOLD;
  const isLeech =
    wrongCount >= LEECH_THRESHOLD && !(grade === Rating.Easy && nextCard.stability >= 14);

  let status: VocabStatus = item.status;
  if (nextCard.state === State.Review && nextCard.scheduled_days >= 21 && !isLeech) {
    status = 'mastered';
  } else if (isWrong) {
    status = 'learning';
  }

  const updated: UserVocabItem = {
    ...item,
    status,
    fsrsCardJson: serializeCard(nextCard),
    wrongCount,
    reviewCount: item.reviewCount + 1,
    isLeech,
    nextReviewAt: nextCard.due.getTime(),
    updatedAt: now.getTime()
  };

  await db.userVocab.put(updated);

  const base = options.baseExp ?? (isWrong ? 2 : grade === Rating.Easy ? 12 : 8);
  const expEarned = options.hardcore && !isWrong ? base * 2 : base;
  await recordStudyActivity({ wordsReviewed: 1, expEarned });

  return {
    item: updated,
    expEarned,
    becameLeech,
    nextDueDate: nextCard.due
  };
}

export async function recordStudyActivity(
  delta: Partial<Omit<StudyLogItem, 'date'>>
): Promise<StudyLogItem> {
  const date = getTodayDateString();
  const existing = await db.studyLogs.get(date);
  const next: StudyLogItem = {
    date,
    wordsLearned: (existing?.wordsLearned || 0) + (delta.wordsLearned || 0),
    wordsReviewed: (existing?.wordsReviewed || 0) + (delta.wordsReviewed || 0),
    gamesPlayed: (existing?.gamesPlayed || 0) + (delta.gamesPlayed || 0),
    expEarned: (existing?.expEarned || 0) + (delta.expEarned || 0),
    minutesStudied: (existing?.minutesStudied || 0) + (delta.minutesStudied || 0)
  };
  await db.studyLogs.put(next);
  return next;
}

export async function getDueVocabItems(limit = 30): Promise<UserVocabItem[]> {
  const now = Date.now();
  return db.userVocab.where('nextReviewAt').belowOrEqual(now).limit(limit).toArray();
}

export async function getLeechVocabItems(limit = 50): Promise<UserVocabItem[]> {
  return db.userVocab.filter((item) => item.isLeech).limit(limit).toArray();
}

/**
 * Chọn bộ từ mục tiêu hôm nay (~60% từ mới theo cấp HSK + ~40% từ chưa thuộc/tử huyệt).
 */
export async function pickDailyTargetWords(
  hskLevel: number,
  dailyGoal: number
): Promise<{
  words: DictionaryEntry[];
  newCount: number;
  reviewCount: number;
}> {
  const goal = Math.max(5, Math.min(50, dailyGoal));
  const reviewTarget = Math.max(2, Math.round(goal * 0.4));
  const newTarget = Math.max(3, goal - reviewTarget);

  const allUserVocab = await db.userVocab.toArray();
  const knownWordIds = new Set(allUserVocab.map((v) => v.wordId));

  // 1. Ưu tiên từ tử huyệt & đến hạn ôn
  const now = Date.now();
  const reviewCandidates = allUserVocab
    .filter((v) => v.status !== 'mastered' && (v.isLeech || v.nextReviewAt <= now))
    .sort((a, b) => {
      if (a.isLeech !== b.isLeech) return a.isLeech ? -1 : 1;
      return a.nextReviewAt - b.nextReviewAt;
    })
    .slice(0, reviewTarget);

  const reviewEntries: DictionaryEntry[] = [];
  for (const uv of reviewCandidates) {
    const entry = await db.dictionary.get(uv.wordId);
    if (entry) reviewEntries.push(entry);
  }

  // 2. Lấy từ mới theo cấp HSK mục tiêu (chưa học)
  let levelWords = await db.dictionary.where('hskLevel').equals(hskLevel).sortBy('frequency');
  let unseen = levelWords.filter((w) => !knownWordIds.has(w.id));

  // Nếu cấp hiện tại không còn đủ từ mới, lấy thêm từ cấp lân cận
  if (unseen.length < newTarget) {
    const allDict = await db.dictionary.orderBy('frequency').toArray();
    const extra = allDict.filter(
      (w) => !knownWordIds.has(w.id) && !unseen.some((u) => u.id === w.id)
    );
    unseen = [...unseen, ...extra];
  }

  const remainingNeeded = goal - reviewEntries.length;
  const newEntries = unseen.slice(0, remainingNeeded);

  return {
    words: [...reviewEntries, ...newEntries],
    newCount: newEntries.length,
    reviewCount: reviewEntries.length
  };
}

export { Rating };
