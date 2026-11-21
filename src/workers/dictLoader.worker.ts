/// <reference lib="webworker" />
import { db } from '@/db/database';
import type { DictionaryEntry, HanziGraphic } from '@/types';
import { buildSearchTokens, stripPinyinTones } from '@/utils/pinyin';

export interface DictWorkerRequest {
  type: 'LOAD_FULL_DB';
  dictUrls: string[];
  graphicsUrls: string[];
  dictBuffer?: ArrayBuffer;
  graphicsBuffer?: ArrayBuffer;
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

/**
 * Giải mã ArrayBuffer có thể là JSON thuần hoặc đã nén GZIP (nhận diện bằng magic bytes 0x1f 0x8b).
 */
async function decodeJsonBuffer<T>(buffer: ArrayBuffer): Promise<T> {
  const bytes = new Uint8Array(buffer);
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

  if (isGzip) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Trình duyệt không hỗ trợ giải nén GZIP (DecompressionStream).');
    }
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    const text = await new Response(stream).text();
    return JSON.parse(text) as T;
  }

  const text = new TextDecoder('utf-8').decode(bytes);
  return JSON.parse(text) as T;
}

async function loadAssetJson<T>(
  preloadedBuffer: ArrayBuffer | undefined,
  urls: string[]
): Promise<T | null> {
  if (preloadedBuffer && preloadedBuffer.byteLength > 20) {
    return decodeJsonBuffer<T>(preloadedBuffer);
  }
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 20) {
          return await decodeJsonBuffer<T>(buf);
        }
      }
    } catch {
      // Thử URL dự phòng tiếp theo
    }
  }
  return null;
}

self.onmessage = async (event: MessageEvent<DictWorkerRequest>) => {
  const { type, dictUrls, graphicsUrls, dictBuffer, graphicsBuffer } = event.data;
  if (type !== 'LOAD_FULL_DB') return;

  try {
    postMessage({
      type: 'PROGRESS',
      percent: 4,
      message: 'Đang giải nén kho từ điển mở rộng tích hợp sẵn...'
    } satisfies DictWorkerProgress);

    let dictAdded = 0;
    let graphicsCount = 0;

    // 1. Nạp Từ điển Mở rộng (giữ nguyên các từ lõi tiếng Việt chuẩn đã có, chỉ bổ sung các từ còn thiếu!)
    const rawDict = await loadAssetJson<DictionaryEntry[]>(dictBuffer, dictUrls);
    if (!rawDict || rawDict.length === 0) {
      throw new Error(
        'Không tìm thấy tệp từ điển mở rộng tích hợp. Hãy cập nhật bản cài đặt mới nhất.'
      );
    }

    const existingCore = await db.dictionary.toArray();
    const existingVietnameseSimplified = new Set<string>();
    for (const item of existingCore) {
      if (!item.id.startsWith('ced_')) {
        existingVietnameseSimplified.add(item.simplified);
      }
    }

    const filteredDict = rawDict.filter((e) => !existingVietnameseSimplified.has(e.simplified));
    const totalDict = filteredDict.length;

    for (let i = 0; i < totalDict; i += BATCH_SIZE) {
      const batch = filteredDict.slice(i, i + BATCH_SIZE).map((entry) => {
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
      dictAdded += batch.length;
      const percent = Math.min(54, Math.round(10 + (dictAdded / Math.max(1, totalDict)) * 44));
      postMessage({
        type: 'PROGRESS',
        percent,
        message: `Đang nạp từ điển mở rộng: ${dictAdded.toLocaleString('vi-VN')} / ${totalDict.toLocaleString('vi-VN')} mục...`
      } satisfies DictWorkerProgress);
    }

    // 2. Nạp >9.500 dữ liệu nét vẽ & chiết tự MakeMeAHanzi
    postMessage({
      type: 'PROGRESS',
      percent: 58,
      message: 'Đang giải nén >9.500 nét vẽ chữ Hán MakeMeAHanzi...'
    } satisfies DictWorkerProgress);

    const rawGraphics = await loadAssetJson<HanziGraphic[]>(graphicsBuffer, graphicsUrls);
    if (rawGraphics && rawGraphics.length > 0) {
      const totalGfx = rawGraphics.length;
      for (let i = 0; i < totalGfx; i += BATCH_SIZE) {
        const batch = rawGraphics.slice(i, i + BATCH_SIZE);
        await db.hanziGraphics.bulkPut(batch);
        graphicsCount += batch.length;
        const percent = Math.min(
          98,
          Math.round(58 + (graphicsCount / Math.max(1, totalGfx)) * 40)
        );
        postMessage({
          type: 'PROGRESS',
          percent,
          message: `Đang nạp nét vẽ chữ Hán: ${graphicsCount.toLocaleString('vi-VN')} / ${totalGfx.toLocaleString('vi-VN')} chữ...`
        } satisfies DictWorkerProgress);
      }
    }

    const totalInDb = await db.dictionary.count();
    const totalGfxInDb = await db.hanziGraphics.count();

    postMessage({
      type: 'DONE',
      percent: 100,
      message: `Hoàn tất! Kho Offline hiện có ${totalInDb.toLocaleString('vi-VN')} mục từ & ${totalGfxInDb.toLocaleString('vi-VN')} nét chữ!`,
      dictCount: totalInDb,
      graphicsCount: totalGfxInDb
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
