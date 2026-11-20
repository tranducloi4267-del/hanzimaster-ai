import type { CharacterJson } from 'hanzi-writer';
import { db } from '@/db/database';

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0';

/**
 * Custom charDataLoader 100% Offline-First cho hanzi-writer:
 * 1. Ưu tiên đọc trực tiếp SVG strokes & medians từ bảng hanziGraphics trong IndexedDB.
 * 2. Chỉ tải bù từ CDN khi gặp chữ hiếm ngoài gói lõi và đang Online, sau đó tự lưu vĩnh viễn vào IndexedDB.
 */
export async function loadHanziWriterCharData(char: string): Promise<CharacterJson> {
  const local = await db.hanziGraphics.get(char);
  if (local && local.strokes && local.strokes.length > 0 && local.medians && local.medians.length > 0) {
    return {
      strokes: local.strokes,
      medians: local.medians
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const res = await fetch(`${CDN_BASE}/${encodeURIComponent(char)}.json`);
    if (res.ok) {
      const data = (await res.json()) as CharacterJson;
      if (data?.strokes?.length && data?.medians?.length) {
        await db.hanziGraphics.put({
          char,
          strokes: data.strokes,
          medians: data.medians,
          decomposition: local?.decomposition || '？',
          etymology: local?.etymology,
          radical: local?.radical || '',
          strokesCount: data.strokes.length
        });
        return data;
      }
    }
  }

  throw new Error(
    `Chữ "${char}" chưa có dữ liệu nét vẽ cục bộ. Hãy kết nối mạng 1 lần hoặc chạy "npm run build:dict" để nạp trọn bộ >9.500 chữ.`
  );
}
