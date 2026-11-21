/**
 * Script biên dịch Kho Từ điển Offline quy mô lớn (>9.500 chữ MakeMeAHanzi + CC-CEDICT + HSK 1–6 & 3.0 + Hán-Việt)
 * Chạy: npm run build:dict
 * Chạy chế độ tạo gói nét lõi cho bộ từ nhúng: node scripts/build-offline-db.mjs --core-only
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const MAKEMEAHANZI_GRAPHICS_URL =
  'https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt';
const MAKEMEAHANZI_DICT_URL =
  'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt';
const CEDICT_GZ_URL =
  'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz';
const HSK_COMPLETE_URL =
  'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.json';

const args = new Set(process.argv.slice(2));
const coreOnly = args.has('--core-only');

const outDataDir = path.resolve('public/data');
fs.mkdirSync(outDataDir, { recursive: true });

async function fetchText(url, label) {
  console.log(`↓ Đang tải ${label}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tải ${label} thất bại (${res.status})`);
  return res.text();
}

async function fetchGzipText(url, label) {
  console.log(`↓ Đang tải ${label} (.gz)...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tải ${label} thất bại (${res.status})`);
  const arrBuf = await res.arrayBuffer();
  return zlib.gunzipSync(Buffer.from(arrBuf)).toString('utf8');
}

function stripToneDigits(py) {
  return py
    .toLowerCase()
    .replace(/[1-5]/g, '')
    .replace(/u:/g, 'u')
    .replace(/v/g, 'u')
    .replace(/\s+/g, ' ')
    .trim();
}

const TONE_VOWELS = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ']
};

function numberedToMarked(input) {
  return input
    .replace(/u:/g, 'ü')
    .replace(/([a-zA-ZüÜ]+)([1-5])/g, (_m, syl, toneStr) => {
      const tone = Number(toneStr);
      if (tone === 5) return syl;
      const low = syl.toLowerCase();
      const idx = tone - 1;
      const apply = (pos) => {
        const table = TONE_VOWELS[low[pos]];
        if (!table) return syl;
        const rep = syl[pos] === low[pos] ? table[idx] : table[idx].toUpperCase();
        return syl.slice(0, pos) + rep + syl.slice(pos + 1);
      };
      if (low.includes('a')) return apply(low.indexOf('a'));
      if (low.includes('e')) return apply(low.indexOf('e'));
      if (low.includes('ou')) return apply(low.indexOf('ou'));
      for (let i = low.length - 1; i >= 0; i--) {
        if (TONE_VOWELS[low[i]]) return apply(i);
      }
      return syl;
    });
}

function collectEmbeddedChars() {
  const files = [
    'src/data/hsk1Words.ts',
    'src/data/hsk2Words.ts',
    'src/data/hsk3Words.ts',
    'src/data/confusables.ts',
    'src/data/radicals214.ts'
  ];
  const chars = new Set();
  for (const rel of files) {
    const abs = path.resolve(rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (code >= 0x4e00 && code <= 0x9fff) chars.add(ch);
    }
  }
  return chars;
}

async function main() {
  console.log('=== HanziMaster AI — Trình biên dịch Kho Từ điển Offline ===');

  const [graphicsRaw, dictMetaRaw] = await Promise.all([
    fetchText(MAKEMEAHANZI_GRAPHICS_URL, 'MakeMeAHanzi graphics.txt'),
    fetchText(MAKEMEAHANZI_DICT_URL, 'MakeMeAHanzi dictionary.txt')
  ]);

  const metaMap = new Map();
  for (const line of dictMetaRaw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      metaMap.set(obj.character, obj);
    } catch {
      // skip malformed
    }
  }

  const allGraphics = [];
  const coreChars = collectEmbeddedChars();
  const coreGraphics = {};

  for (const line of graphicsRaw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const g = JSON.parse(line);
      const m = metaMap.get(g.character) || {};
      const item = {
        char: g.character,
        strokes: g.strokes,
        medians: g.medians,
        decomposition: m.decomposition || '？',
        etymology: m.etymology || undefined,
        radical: m.radical || '',
        strokesCount: Array.isArray(g.strokes) ? g.strokes.length : 0
      };
      allGraphics.push(item);
      if (coreChars.has(g.character)) {
        coreGraphics[g.character] = item;
      }
    } catch {
      // skip
    }
  }

  // Luôn lưu bộ nét MakeMeAHanzi thực cho toàn bộ chữ thuộc gói lõi HSK 1–3!
  const coreOutPath = path.resolve('src/data/coreGraphics.json');
  fs.writeFileSync(coreOutPath, JSON.stringify(coreGraphics), 'utf8');
  console.log(
    `✓ Đã xuất ${Object.keys(coreGraphics).length} chữ MakeMeAHanzi thực -> src/data/coreGraphics.json`
  );

  if (coreOnly) {
    console.log('✓ Hoàn tất chế độ --core-only.');
    return;
  }

  // Ghi full graphics nén gzip (.json.gz) để đóng gói thẳng vào APK & EXE gọn nhẹ (~5-6 MB)
  const fullGfxGzPath = path.join(outDataDir, 'full-graphics.json.gz');
  const gfxJsonBuf = Buffer.from(JSON.stringify(allGraphics), 'utf8');
  const gfxGzBuf = zlib.gzipSync(gfxJsonBuf, { level: 9 });
  fs.writeFileSync(fullGfxGzPath, gfxGzBuf);
  const rawGfxOld = path.join(outDataDir, 'full-graphics.json');
  if (fs.existsSync(rawGfxOld)) fs.unlinkSync(rawGfxOld);
  console.log(
    `✓ Đã xuất ${allGraphics.length} chữ nét vẽ nén (${(gfxGzBuf.length / 1024 / 1024).toFixed(2)} MB) -> public/data/full-graphics.json.gz`
  );

  // Tải HSK 1–6 & HSK 3.0 từ drkameleon/complete-hsk-vocabulary
  const hskMap = new Map();
  try {
    const hskJson = JSON.parse(await fetchText(HSK_COMPLETE_URL, 'HSK 2.0 & 3.0 Vocabulary'));
    for (const item of hskJson) {
      const levels = Array.isArray(item.level) ? item.level : [];
      let hsk2 = 0;
      let hsk3 = 0;
      for (const lv of levels) {
        if (typeof lv === 'string') {
          if (lv.startsWith('old-')) hsk2 = Number(lv.slice(4)) || hsk2;
          if (lv.startsWith('new-')) {
            const num = lv.slice(4);
            hsk3 = num === '7-9' ? 7 : Number(num) || hsk3;
          }
        }
      }
      hskMap.set(item.simplified, {
        hsk2,
        hsk3,
        frequency: item.frequency || 50000,
        radical: item.radical || ''
      });
    }
    console.log(`✓ Đã ánh xạ ${hskMap.size} từ chuẩn HSK 1–6 & HSK 3.0`);
  } catch (err) {
    console.warn('⚠ Không tải được bảng HSK mở rộng, tiếp tục với CC-CEDICT:', err.message);
  }

  // Tải CC-CEDICT
  const cedictRaw = await fetchGzipText(CEDICT_GZ_URL, 'CC-CEDICT');
  const fullEntries = [];
  let idx = 0;

  for (const line of cedictRaw.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/);
    if (!match) continue;
    const [, trad, simp, pyNumRaw, defsRaw] = match;
    const hskInfo = hskMap.get(simp);

    // Ưu tiên toàn bộ từ HSK 1–6 & 3.0 + từ đơn + 15.000 từ phổ thông nhất để giữ file gọn cho di động
    const isImportant = Boolean(hskInfo) || simp.length === 1 || idx < 18000;
    if (!isImportant) continue;

    const pinyin = numberedToMarked(pyNumRaw);
    const pinyinNoTone = stripToneDigits(pyNumRaw);
    const meanings = defsRaw
      .split('/')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('CL:'))
      .slice(0, 5);
    if (meanings.length === 0) continue;

    const firstMeta = metaMap.get(simp[0]);
    const firstGfx = coreGraphics[simp[0]];

    fullEntries.push({
      id: `ced_${simp}_${idx}`,
      simplified: simp,
      traditional: trad !== simp ? trad : undefined,
      pinyin,
      pinyinNoTone,
      pinyinNumbered: pyNumRaw.replace(/\s+/g, '').toLowerCase(),
      hanViet: '', // Sẽ được bổ sung/hiển thị kết hợp bảng lõi & AI on-demand
      meanings,
      hskLevel: hskInfo?.hsk2 || 0,
      hsk3Level: hskInfo?.hsk3 || 0,
      frequency: hskInfo?.frequency || 10000 + idx,
      strokesCount: firstGfx?.strokesCount || (firstMeta?.matches ? firstMeta.matches.length : 8),
      radical: hskInfo?.radical || firstMeta?.radical || ''
    });
    idx++;
  }

  const fullDictGzPath = path.join(outDataDir, 'full-dictionary.json.gz');
  const dictJsonBuf = Buffer.from(JSON.stringify(fullEntries), 'utf8');
  const dictGzBuf = zlib.gzipSync(dictJsonBuf, { level: 9 });
  fs.writeFileSync(fullDictGzPath, dictGzBuf);
  const rawDictOld = path.join(outDataDir, 'full-dictionary.json');
  if (fs.existsSync(rawDictOld)) fs.unlinkSync(rawDictOld);
  console.log(
    `✓ Đã xuất ${fullEntries.length} mục từ điển nén (${(dictGzBuf.length / 1024 / 1024).toFixed(2)} MB) -> public/data/full-dictionary.json.gz`
  );
  console.log('=== Hoàn tất! Gói từ điển mở rộng đã sẵn sàng đóng gói trực tiếp vào APK & EXE ===');
}

main().catch((err) => {
  console.error('✗ Lỗi build từ điển:', err);
  process.exit(1);
});
