import { db, getSetting, setSetting } from './database';
import { getEmbeddedDictionaryEntries } from '@/data/embeddedWords';
import { setTokenizerVocabulary } from '@/services/dictionary/tokenizer';
import type { DictWorkerProgress } from '@/workers/dictLoader.worker';
import type { HanziGraphic } from '@/types';

const CORE_SEED_VERSION = 'v1.0.0';

/**
 * Đảm bảo cơ sở dữ liệu IndexedDB luôn có sẵn bộ từ điển lõi (520+ từ HSK 1–3 chuẩn tiếng Việt)
 * và dữ liệu nét vẽ MakeMeAHanzi thực ngay lần mở đầu tiên, kể cả khi hoàn toàn offline.
 */
export async function ensureCoreDatabaseSeeded(
  onProgress?: (percent: number, message: string) => void
): Promise<{ dictCount: number; graphicsCount: number }> {
  const seededVersion = await getSetting<string>('coreSeedVersion', '');
  const existingDictCount = await db.dictionary.count();
  const existingGfxCount = await db.hanziGraphics.count();

  if (seededVersion !== CORE_SEED_VERSION || existingDictCount < 300 || existingGfxCount < 100) {
    onProgress?.(15, 'Đang khởi tạo kho từ điển lõi HSK 1–3 tiếng Việt...');
    const entries = getEmbeddedDictionaryEntries();
    await db.dictionary.bulkPut(entries);

    onProgress?.(55, 'Đang nạp dữ liệu nét vẽ & chiết tự MakeMeAHanzi...');
    const { default: coreGraphicsRaw } = await import('@/data/coreGraphics.json');
    const graphicsList = Object.values(coreGraphicsRaw as unknown as Record<string, HanziGraphic>);
    if (graphicsList.length > 0) {
      const BATCH = 500;
      for (let i = 0; i < graphicsList.length; i += BATCH) {
        await db.hanziGraphics.bulkPut(graphicsList.slice(i, i + BATCH));
      }
    }

    await setSetting('coreSeedVersion', CORE_SEED_VERSION);
    onProgress?.(90, 'Đang lập chỉ mục tìm kiếm nhanh...');
  }

  // Nạp toàn bộ từ vào bộ tách từ <InteractiveHanziText> (Longest-Match)
  const allWords = await db.dictionary.toCollection().primaryKeys();
  const simplifiedList = (await db.dictionary.toArray()).map((d) => d.simplified);
  setTokenizerVocabulary(simplifiedList);

  const finalDictCount = allWords.length;
  const finalGfxCount = await db.hanziGraphics.count();
  onProgress?.(100, `Sẵn sàng (${finalDictCount.toLocaleString('vi-VN')} mục từ)`);

  return { dictCount: finalDictCount, graphicsCount: finalGfxCount };
}

/**
 * Nạp gói từ điển mở rộng (>9.500 chữ MakeMeAHanzi + CC-CEDICT + HSK 1–6 & 3.0)
 * bằng Web Worker (bulkPut theo lô 750 dòng) để không làm đơ giao diện di động.
 */
export function importFullDatabaseViaWorker(
  onProgress: (p: DictWorkerProgress) => void
): Promise<{ dictCount: number; graphicsCount: number }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/dictLoader.worker.ts', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = async (event: MessageEvent<DictWorkerProgress>) => {
      const data = event.data;
      onProgress(data);
      if (data.type === 'DONE') {
        worker.terminate();
        // Cập nhật lại tokenizer sau khi nạp xong Full DB
        const simplifiedList = (await db.dictionary.toArray()).map((d) => d.simplified);
        setTokenizerVocabulary(simplifiedList);
        resolve({
          dictCount: data.dictCount || 0,
          graphicsCount: data.graphicsCount || 0
        });
      } else if (data.type === 'ERROR') {
        worker.terminate();
        reject(new Error(data.error || data.message));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message || 'Lỗi Web Worker nạp từ điển'));
    };

    const base = import.meta.env.BASE_URL || './';
    worker.postMessage({
      type: 'LOAD_FULL_DB',
      dictUrl: `${base}data/full-dictionary.json`,
      graphicsUrl: `${base}data/full-graphics.json`
    });
  });
}
