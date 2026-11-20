const TONE_MAP: Record<string, { base: string; tone: number }> = {
  ā: { base: 'a', tone: 1 },
  á: { base: 'a', tone: 2 },
  ǎ: { base: 'a', tone: 3 },
  à: { base: 'a', tone: 4 },
  ē: { base: 'e', tone: 1 },
  é: { base: 'e', tone: 2 },
  ě: { base: 'e', tone: 3 },
  è: { base: 'e', tone: 4 },
  ī: { base: 'i', tone: 1 },
  í: { base: 'i', tone: 2 },
  ǐ: { base: 'i', tone: 3 },
  ì: { base: 'i', tone: 4 },
  ō: { base: 'o', tone: 1 },
  ó: { base: 'o', tone: 2 },
  ǒ: { base: 'o', tone: 3 },
  ò: { base: 'o', tone: 4 },
  ū: { base: 'u', tone: 1 },
  ú: { base: 'u', tone: 2 },
  ǔ: { base: 'u', tone: 3 },
  ù: { base: 'u', tone: 4 },
  ǖ: { base: 'v', tone: 1 },
  ǘ: { base: 'v', tone: 2 },
  ǚ: { base: 'v', tone: 3 },
  ǜ: { base: 'v', tone: 4 },
  ü: { base: 'v', tone: 0 }
};

const BASE_TO_TONE: Record<string, [string, string, string, string]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ']
};

export function stripPinyinTones(pinyin: string): string {
  let out = '';
  for (const ch of pinyin.toLowerCase()) {
    const mapped = TONE_MAP[ch];
    if (mapped) {
      out += mapped.base === 'v' ? 'u' : mapped.base;
    } else if (ch === 'ü') {
      out += 'u';
    } else if (!/[0-5]/.test(ch)) {
      out += ch;
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function stripPinyinCompact(pinyin: string): string {
  return stripPinyinTones(pinyin).replace(/[^a-z]/g, '');
}

export function pinyinToNumbered(pinyin: string): string {
  const syllables = pinyin.trim().split(/\s+/);
  return syllables
    .map((syl) => {
      let tone = 5;
      let base = '';
      for (const ch of syl.toLowerCase()) {
        const mapped = TONE_MAP[ch];
        if (mapped) {
          if (mapped.tone > 0) tone = mapped.tone;
          base += mapped.base === 'v' ? 'v' : mapped.base;
        } else {
          base += ch;
        }
      }
      return `${base}${tone}`;
    })
    .join('');
}

export function numberedPinyinToMarks(input: string): string {
  return input.replace(/([a-zA-ZüÜvV]+)([1-5])/g, (_match, rawSyl: string, toneChar: string) => {
    const tone = Number(toneChar);
    const syl = rawSyl.replace(/v/g, 'ü').replace(/V/g, 'Ü');
    if (tone === 5) return syl;
    const lower = syl.toLowerCase();
    const idx = tone - 1;
    // Standard pinyin tone placement rule: a/e first, then o in ou, else last vowel
    const applyAt = (pos: number): string => {
      const ch = lower[pos];
      const table = BASE_TO_TONE[ch];
      if (!table) return syl;
      const marked = table[idx];
      const isUpper = syl[pos] !== lower[pos];
      return syl.slice(0, pos) + (isUpper ? marked.toUpperCase() : marked) + syl.slice(pos + 1);
    };
    const aPos = lower.indexOf('a');
    if (aPos !== -1) return applyAt(aPos);
    const ePos = lower.indexOf('e');
    if (ePos !== -1) return applyAt(ePos);
    const ouPos = lower.indexOf('ou');
    if (ouPos !== -1) return applyAt(ouPos);
    for (let i = lower.length - 1; i >= 0; i--) {
      if (BASE_TO_TONE[lower[i]]) {
        return applyAt(i);
      }
    }
    return syl;
  });
}

export function extractToneNumbers(pinyin: string): number[] {
  const tokens = pinyin.trim().split(/[\s']+/).filter(Boolean);
  return tokens.map((syl) => {
    const numMatch = syl.match(/([1-5])$/);
    if (numMatch) return Number(numMatch[1]);
    for (const ch of syl.toLowerCase()) {
      const mapped = TONE_MAP[ch];
      if (mapped && mapped.tone > 0) return mapped.tone;
    }
    return 5;
  });
}

export function removeVietnameseDiacritics(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

export function isHanziChar(ch: string): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

export function containsHanzi(text: string): boolean {
  for (const ch of text) {
    if (isHanziChar(ch)) return true;
  }
  return false;
}

export function extractUniqueHanzi(text: string): string[] {
  const seen = new Set<string>();
  for (const ch of text) {
    if (isHanziChar(ch)) seen.add(ch);
  }
  return Array.from(seen);
}

export function buildSearchTokens(entry: {
  simplified: string;
  pinyin: string;
  pinyinNoTone: string;
  hanViet: string;
  meanings: string[];
}): string[] {
  const tokens = new Set<string>();
  const add = (val: string) => {
    const clean = val.trim().toLowerCase();
    if (clean) tokens.add(clean);
  };

  add(entry.simplified);
  for (const ch of entry.simplified) {
    if (isHanziChar(ch)) add(ch);
  }
  add(entry.pinyin);
  add(entry.pinyinNoTone);
  const compact = stripPinyinCompact(entry.pinyin);
  add(compact);
  add(pinyinToNumbered(entry.pinyin));

  for (const syl of entry.pinyinNoTone.split(/\s+/)) {
    add(syl);
  }

  const hvNorm = removeVietnameseDiacritics(entry.hanViet);
  add(entry.hanViet.toLowerCase());
  add(hvNorm);
  for (const part of hvNorm.split(/[\s,/()-]+/)) {
    if (part.length >= 2) add(part);
  }

  for (const m of entry.meanings) {
    const mNorm = removeVietnameseDiacritics(m);
    for (const word of mNorm.split(/[\s,;()/.!?-]+/)) {
      if (word.length >= 2) add(word);
    }
  }

  return Array.from(tokens);
}

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function hashString(input: string): string {
  // Fast deterministic FNV-1a 64-bit-like dual 32-bit hash (works sync everywhere, including offline)
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + (i << 1);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function createId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
