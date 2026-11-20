import Dexie, { type EntityTable } from 'dexie';
import type {
  AiCacheItem,
  AudioCacheItem,
  DictionaryEntry,
  DocumentItem,
  ExamHistoryItem,
  HanziGraphic,
  LessonItem,
  SettingItem,
  StudyLogItem,
  UserVocabItem
} from '@/types';

export class HanziMasterDB extends Dexie {
  dictionary!: EntityTable<DictionaryEntry, 'id'>;
  hanziGraphics!: EntityTable<HanziGraphic, 'char'>;
  userVocab!: EntityTable<UserVocabItem, 'id'>;
  lessons!: EntityTable<LessonItem, 'id'>;
  documents!: EntityTable<DocumentItem, 'id'>;
  examHistory!: EntityTable<ExamHistoryItem, 'id'>;
  aiCache!: EntityTable<AiCacheItem, 'cacheKey'>;
  audioCache!: EntityTable<AudioCacheItem, 'textHash'>;
  studyLogs!: EntityTable<StudyLogItem, 'date'>;
  settings!: EntityTable<SettingItem, 'key'>;

  constructor(name = 'HanziMasterDB') {
    super(name);
    this.version(1).stores({
      dictionary:
        'id, simplified, pinyin, pinyinNoTone, hskLevel, hsk3Level, frequency, strokesCount, radical, *searchTokens',
      hanziGraphics: 'char, strokesCount, radical',
      userVocab: 'id, wordId, simplified, status, isLeech, nextReviewAt, source, addedAt',
      lessons: 'id, date, level, sourceType, completed, createdAt',
      documents: 'id, title, fileType, createdAt',
      examHistory: 'id, level, score, createdAt',
      aiCache: 'cacheKey, type, createdAt',
      audioCache: 'textHash, createdAt, lastAccessedAt, sizeBytes',
      studyLogs: 'date',
      settings: 'key'
    });
  }
}

export const db = new HanziMasterDB();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}
