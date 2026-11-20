/// <reference lib="webworker" />
import { db } from '@/db/database';
import type { DictionaryEntry, HanziGraphic } from '@/types';
import { buildSearchTokens, stripPinyinTones } from '@/utils/pinyin';

export interface DictWorkerRequest {
  type: 'LOAD_FULL_DB';
  dictUrl: string;
  graphicsUrl: string;
}

export interface DictWorkerProgress {
  type: 'PROGRESS' | 'DONE' | 'ERROR';
  percent: number;
  message: string;
  dictCount?: number;
  graphicsCount?: number;
  error?: string;
}

const BATCH_SIZE = 750;

self.onmessage = async (event: MessageEvent<DictWorkerRequest>) => {
  const { type, dictUrl, graphicsUrl } = event.data;
  if (type !== 'LOAD_FULL_DB') return;

  try {
    postMessage({
      type: 'PROGRESS',
      percent: 5,
      message: 'Đang tải tệp từ điển mở rộng...'
    } satisfies DictWorkerProgress);

    let dictCount = 0;
    let graphicsCount = 0;

    // 1. Load dictionary JSON
    const dictRes = await fetch(dictUrl);
    if (!dictRes.ok) {
      throw new Error(
        `Không tìm thấy tệp từ điển mở rộng (${dictRes.status}). Hãy chạy "npm run build:dict" trước.`
      );
    }
    const rawDict: DictionaryEntry[] = await dictRes.json();
    const totalDict = rawDict.length;

    for (let i = 0; i < totalDict; i += BATCH_SIZE) {
      const batch = rawDict.slice(i, i + BATCH_SIZE).map((entry) => {
        const pinyinNoTone = entry.pinyinNoTone || stripPinyinTones(entry.pinyin);
        return {
          ...entry,
          pinyinNoTone,
          searchTokens:
            entry.searchTokens && entry.searchTokens.length > 0
              ? entry.searchTokens
              : buildSearchTokens({
                  simplified: entry.simplified,
                  pinyin: entry.pinyin,
                  pinyinNoTone,
                  hanViet: entry.hanViet,
                  meanings: entry.meanings
                })
        };
      });
      await db.dictionary.bulkPut(batch);
      dictCount += batch.length;
      const percent = Math.min(55, Math.round(10 + (dictCount / Math.max(1, totalDict)) * 45));
      postMessage({
        type: 'PROGRESS',
        percent,
        message: `Đang nạp từ điển: ${dictCount.toLocaleString('vi-VN')} / ${totalDict.toLocaleString('vi-VN')} mục...`
      } satisfies DictWorkerProgress);
    }

    // 2. Load MakeMeAHanzi graphics JSON
    const gfxRes = await fetch(graphicsUrl);
    if (gfxRes.ok) {
      const rawGraphics: HanziGraphic[] = await gfxRes.json();
      const totalGfx = rawGraphics.length;
      for (let i = 0; i < totalGfx; i += BATCH_SIZE) {
        const batch = rawGraphics.slice(i, i + BATCH_SIZE);
        await db.hanziGraphics.bulkPut(batch);
        graphicsCount += batch.length;
        const percent = Math.min(
          98,
          Math.round(55 + (graphicsCount / Math.max(1, totalGfx)) * 43)
        );
        postMessage({
          type: 'PROGRESS',
          percent,
          message: `Đang nạp nét vẽ chữ Hán: ${graphicsCount.toLocaleString('vi-VN')} / ${totalGfx.toLocaleString('vi-VN')} chữ...`
        } satisfies DictWorkerProgress);
      }
    }

    postMessage({
      type: 'DONE',
      percent: 100,
      message: `Hoàn tất nạp ${dictCount.toLocaleString('vi-VN')} mục từ & ${graphicsCount.toLocaleString('vi-VN')} dữ liệu nét chữ!`,
      dictCount,
      graphicsCount
    } satisfies DictWorkerProgress);
  } catch (err) {
    postMessage({
      type: 'ERROR',
      percent: 0,
      message: 'Lỗi khi nạp kho từ điển mở rộng',
      error: err instanceof Error ? err.message : String(err)
    } satisfies DictWorkerProgress);
  }
};
