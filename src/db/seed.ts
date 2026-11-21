import { db, getSetting, setSetting } from './database';
import { getEmbeddedDictionaryEntries } from '@/data/embeddedWords';
import { setTokenizerVocabulary } from '@/services/dictionary/tokenizer';
import { invalidateDictionaryCache } from '@/services/dictionary/dictionaryService';
import { invalidateHandwritingIndex } from '@/services/handwriting/matcher';
import type { DictWorkerProgress, DictWorkerRequest } from '@/workers/dictLoader.worker';
import type { HanziGraphic } from '@/types';

const CORE_SEED_VERSION = 'v1.1.0';
const FULL_DB_VERSION = 'v1.1.0';

/**
 * Đảm bảo cơ sở dữ liệu IndexedDB luôn có sẵn bộ từ điển lõi (HSK 1–3 chuẩn tiếng Việt)
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

  const allEntries = await db.dictionary.toArray();
  setTokenizerVocabulary(allEntries.map((d) => d.simplified));

  const finalDictCount = allEntries.length;
  const finalGfxCount = await db.hanziGraphics.count();
  onProgress?.(100, `Sẵn sàng (${finalDictCount.toLocaleString('vi-VN')} mục từ)`);

  return { dictCount: finalDictCount, graphicsCount: finalGfxCount };
}

/**
 * Nạp gói từ điển mở rộng (>9.500 chữ MakeMeAHanzi + CC-CEDICT + HSK 1–6 & 3.0)
 * được đóng gói sẵn (.json.gz) ngay trong APK & EXE bằng Web Worker (không đơ giao diện).
 */
export async function importFullDatabaseViaWorker(
  onProgress: (p: DictWorkerProgress) => void
): Promise<{ dictCount: number; graphicsCount: number }> {
  // Nếu chạy trên Electron Windows (.exe), đọc trực tiếp tệp nén từ dist/data qua IPC để tránh giới hạn fetch(file://) trong Web Worker
  let dictBuffer: ArrayBuffer | undefined;
  let graphicsBuffer: ArrayBuffer | undefined;

  if (typeof window !== 'undefined' && window.electronAPI?.readBundledDataAsset) {
    try {
      const dBytes =
        (await window.electronAPI.readBundledDataAsset('full-dictionary.json.gz')) ||
        (await window.electronAPI.readBundledDataAsset('full-dictionary.json'));
      if (dBytes && dBytes.byteLength > 20) {
        dictBuffer = dBytes.slice().buffer;
      }
      const gBytes =
        (await window.electronAPI.readBundledDataAsset('full-graphics.json.gz')) ||
        (await window.electronAPI.readBundledDataAsset('full-graphics.json'));
      if (gBytes && gBytes.byteLength > 20) {
        graphicsBuffer = gBytes.slice().buffer;
      }
    } catch {
      // Fallback sang fetch URL bên dưới
    }
  }

  const base = import.meta.env.BASE_URL || './';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/dictLoader.worker.ts', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = async (event: MessageEvent<DictWorkerProgress>) => {
      const data = event.data;
      onProgress(data);
      if (data.type === 'DONE') {
        worker.terminate();
        invalidateDictionaryCache();
        invalidateHandwritingIndex();
        const allEntries = await db.dictionary.toArray();
        setTokenizerVocabulary(allEntries.map((d) => d.simplified));
        await setSetting('fullDbLoadedVersion', FULL_DB_VERSION);
        resolve({
          dictCount: data.dictCount || allEntries.length,
          graphicsCount: data.graphicsCount || (await db.hanziGraphics.count())
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

    const payload: DictWorkerRequest = {
      type: 'LOAD_FULL_DB',
      dictUrls: [
        `${normalizedBase}data/full-dictionary.json.gz`,
        `${normalizedBase}data/full-dictionary.json`,
        './data/full-dictionary.json.gz',
        '/data/full-dictionary.json.gz'
      ],
      graphicsUrls: [
        `${normalizedBase}data/full-graphics.json.gz`,
        `${normalizedBase}data/full-graphics.json`,
        './data/full-graphics.json.gz',
        '/data/full-graphics.json.gz'
      ],
      dictBuffer,
      graphicsBuffer
    };

    const transferables: Transferable[] = [];
    if (dictBuffer) transferables.push(dictBuffer);
    if (graphicsBuffer) transferables.push(graphicsBuffer);

    worker.postMessage(payload, transferables);
  });
}

/**
 * Tự động giải nén & nạp ngầm kho từ điển mở rộng đóng gói sẵn ngay lần đầu mở app APK / EXE
 * (người dùng không cần bấm nút tay, mở app lên là có sẵn trong bộ nhớ!).
 */
export async function autoLoadBundledFullDatabaseIfAvailable(
  onProgress?: (p: DictWorkerProgress) => void
): Promise<{ loaded: boolean; dictCount: number; graphicsCount: number }> {
  const loadedVer = await getSetting<string>('fullDbLoadedVersion', '');
  const currentDict = await db.dictionary.count();
  const currentGfx = await db.hanziGraphics.count();

  if (loadedVer === FULL_DB_VERSION && currentDict >= 5000 && currentGfx >= 5000) {
    return { loaded: false, dictCount: currentDict, graphicsCount: currentGfx };
  }

  try {
    const res = await importFullDatabaseViaWorker((p) => {
      onProgress?.(p);
    });
    return { loaded: true, dictCount: res.dictCount, graphicsCount: res.graphicsCount };
  } catch {
    // Nếu đang chạy môi trường dev local chưa chạy npm run build:dict -> giữ nguyên bộ lõi hoạt động mượt, không crash app
    return { loaded: false, dictCount: currentDict, graphicsCount: currentGfx };
  }
}
