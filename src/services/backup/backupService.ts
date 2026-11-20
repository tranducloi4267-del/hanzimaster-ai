import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { db, getSetting, setSetting } from '@/db/database';
import type {
  AiCacheItem,
  DocumentItem,
  ExamHistoryItem,
  LessonItem,
  StudyLogItem,
  UserVocabItem
} from '@/types';
import { getTodayDateString } from '@/utils/pinyin';

export interface StorageBreakdown {
  dictionaryBytes: number;
  dictionaryCount: number;
  graphicsCount: number;
  aiCacheBytes: number;
  aiCacheCount: number;
  audioCacheBytes: number;
  audioCacheCount: number;
  userDataBytes: number;
  userVocabCount: number;
}

function estimateJsonBytes(obj: unknown): number {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return 0;
  }
}

export async function measureStorageUsage(): Promise<StorageBreakdown> {
  const [dict, gfxCount, aiItems, audioItems, vocab, lessons, docs, exams, logs] =
    await Promise.all([
      db.dictionary.toArray(),
      db.hanziGraphics.count(),
      db.aiCache.toArray(),
      db.audioCache.toArray(),
      db.userVocab.toArray(),
      db.lessons.toArray(),
      db.documents.toArray(),
      db.examHistory.toArray(),
      db.studyLogs.toArray()
    ]);

  const audioCacheBytes = audioItems.reduce(
    (sum, a) => sum + (a.sizeBytes || a.audioBlob?.size || 0),
    0
  );

  return {
    dictionaryBytes: estimateJsonBytes(dict),
    dictionaryCount: dict.length,
    graphicsCount: gfxCount,
    aiCacheBytes: estimateJsonBytes(aiItems),
    aiCacheCount: aiItems.length,
    audioCacheBytes,
    audioCacheCount: audioItems.length,
    userDataBytes: estimateJsonBytes({ vocab, lessons, docs, exams, logs }),
    userVocabCount: vocab.length
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface HanziMasterBackupPayload {
  app: 'HanziMasterAI';
  schemaVersion: 1;
  exportedAt: number;
  includesApiKey: boolean;
  data: {
    userVocab: UserVocabItem[];
    lessons: LessonItem[];
    documents: DocumentItem[];
    examHistory: ExamHistoryItem[];
    aiCache: AiCacheItem[];
    studyLogs: StudyLogItem[];
    settings: Array<{ key: string; value: unknown }>;
  };
}

export async function buildBackupPayload(
  includeApiKey = false
): Promise<HanziMasterBackupPayload> {
  const [userVocab, lessons, documents, examHistory, aiCache, studyLogs, allSettings] =
    await Promise.all([
      db.userVocab.toArray(),
      db.lessons.toArray(),
      db.documents.toArray(),
      db.examHistory.toArray(),
      db.aiCache.toArray(),
      db.studyLogs.toArray(),
      db.settings.toArray()
    ]);

  const filteredSettings = allSettings.filter((s) => {
    if (s.key === 'coreSeedVersion') return false;
    if (!includeApiKey && s.key === 'geminiApiKeyEncrypted') return false;
    return true;
  });

  // Nếu người dùng chủ động tick bao gồm API Key, xuất dạng plain text để chuyển qua thiết bị khác (Android <-> Windows)
  if (includeApiKey) {
    const rawStored = await getSetting<string>('geminiApiKeyEncrypted', '');
    let plainKey = rawStored;
    if (typeof window !== 'undefined' && window.electronAPI?.decryptSecret && rawStored) {
      try {
        plainKey = await window.electronAPI.decryptSecret(rawStored);
      } catch {
        plainKey = rawStored;
      }
    }
    const idx = filteredSettings.findIndex((s) => s.key === 'geminiApiKeyEncrypted');
    if (idx >= 0) {
      filteredSettings[idx] = { key: 'geminiApiKeyEncrypted', value: plainKey };
    } else if (plainKey) {
      filteredSettings.push({ key: 'geminiApiKeyEncrypted', value: plainKey });
    }
  }

  return {
    app: 'HanziMasterAI',
    schemaVersion: 1,
    exportedAt: Date.now(),
    includesApiKey: includeApiKey,
    data: {
      userVocab,
      lessons,
      documents,
      examHistory,
      aiCache,
      studyLogs,
      settings: filteredSettings
    }
  };
}

export async function downloadOrShareBackup(includeApiKey = false): Promise<string> {
  const payload = await buildBackupPayload(includeApiKey);
  const jsonText = JSON.stringify(payload, null, 2);
  const filename = `hanzimaster-backup-${getTodayDateString()}.json`;

  if (Capacitor.isNativePlatform()) {
    const saved = await Filesystem.writeFile({
      path: filename,
      data: jsonText,
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    });
    await Share.share({
      title: 'Sao lưu HanziMaster AI',
      text: `Tệp sao lưu dữ liệu học tiếng Trung (${filename})`,
      url: saved.uri,
      dialogTitle: 'Lưu hoặc chia sẻ tệp sao lưu JSON'
    });
    return filename;
  }

  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}

export async function importBackupJson(
  rawJson: string,
  mode: 'overwrite' | 'merge'
): Promise<{ vocabCount: number; lessonCount: number; examCount: number }> {
  let parsed: HanziMasterBackupPayload;
  try {
    parsed = JSON.parse(rawJson) as HanziMasterBackupPayload;
  } catch {
    throw new Error('Tệp JSON không hợp lệ hoặc bị hỏng định dạng.');
  }

  if (parsed?.app !== 'HanziMasterAI' || !parsed.data) {
    throw new Error('Tệp này không phải bản sao lưu hợp lệ của HanziMaster AI.');
  }

  const d = parsed.data;

  if (mode === 'overwrite') {
    await db.transaction(
      'rw',
      [db.userVocab, db.lessons, db.documents, db.examHistory, db.aiCache, db.studyLogs],
      async () => {
        await Promise.all([
          db.userVocab.clear(),
          db.lessons.clear(),
          db.documents.clear(),
          db.examHistory.clear(),
          db.aiCache.clear(),
          db.studyLogs.clear()
        ]);
        if (d.userVocab?.length) await db.userVocab.bulkPut(d.userVocab);
        if (d.lessons?.length) await db.lessons.bulkPut(d.lessons);
        if (d.documents?.length) await db.documents.bulkPut(d.documents);
        if (d.examHistory?.length) await db.examHistory.bulkPut(d.examHistory);
        if (d.aiCache?.length) await db.aiCache.bulkPut(d.aiCache);
        if (d.studyLogs?.length) await db.studyLogs.bulkPut(d.studyLogs);
      }
    );
  } else {
    // Gộp thông minh (Merge giữ bản cập nhật mới hơn)
    for (const incoming of d.userVocab || []) {
      const existing = await db.userVocab.get(incoming.id);
      if (!existing || (incoming.updatedAt || 0) >= (existing.updatedAt || 0)) {
        await db.userVocab.put(incoming);
      }
    }
    for (const incoming of d.lessons || []) {
      const existing = await db.lessons.get(incoming.id);
      if (!existing || incoming.createdAt >= existing.createdAt) {
        await db.lessons.put(incoming);
      }
    }
    for (const incoming of d.documents || []) {
      const existing = await db.documents.get(incoming.id);
      if (!existing || incoming.createdAt >= existing.createdAt) {
        await db.documents.put(incoming);
      }
    }
    for (const incoming of d.examHistory || []) {
      const existing = await db.examHistory.get(incoming.id);
      if (!existing || incoming.createdAt >= existing.createdAt) {
        await db.examHistory.put(incoming);
      }
    }
    for (const incoming of d.aiCache || []) {
      const existing = await db.aiCache.get(incoming.cacheKey);
      if (!existing || incoming.createdAt >= existing.createdAt) {
        await db.aiCache.put(incoming);
      }
    }
    for (const incoming of d.studyLogs || []) {
      const existing = await db.studyLogs.get(incoming.date);
      if (!existing) {
        await db.studyLogs.put(incoming);
      } else {
        await db.studyLogs.put({
          date: incoming.date,
          wordsLearned: Math.max(existing.wordsLearned, incoming.wordsLearned),
          wordsReviewed: Math.max(existing.wordsReviewed, incoming.wordsReviewed),
          gamesPlayed: Math.max(existing.gamesPlayed, incoming.gamesPlayed),
          expEarned: Math.max(existing.expEarned, incoming.expEarned),
          minutesStudied: Math.max(existing.minutesStudied, incoming.minutesStudied)
        });
      }
    }
  }

  // Khôi phục cài đặt (mã hóa lại API Key nếu chạy trên Electron)
  for (const s of d.settings || []) {
    if (s.key === 'geminiApiKeyEncrypted' && typeof s.value === 'string' && s.value) {
      let toStore = s.value;
      if (typeof window !== 'undefined' && window.electronAPI?.encryptSecret) {
        try {
          toStore = await window.electronAPI.encryptSecret(s.value);
        } catch {
          toStore = s.value;
        }
      }
      await setSetting(s.key, toStore);
    } else if (s.key === 'appSettings') {
      await setSetting(s.key, s.value);
    }
  }

  return {
    vocabCount: d.userVocab?.length || 0,
    lessonCount: d.lessons?.length || 0,
    examCount: d.examHistory?.length || 0
  };
}
