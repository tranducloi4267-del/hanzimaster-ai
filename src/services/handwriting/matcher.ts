import { db } from '@/db/database';
import type { HanziGraphic } from '@/types';

export interface StrokePoint {
  x: number;
  y: number;
}

export type UserStroke = StrokePoint[];

export interface RecognitionCandidate {
  char: string;
  score: number; // 0..100 (higher = better)
  strokesCount: number;
}

interface NormalizedStroke {
  points: StrokePoint[]; // RESAMPLE_N points in [0..1]x[0..1], Y pointing DOWN
  dirX: number;
  dirY: number;
  length: number;
}

interface IndexedGraphic {
  char: string;
  strokesCount: number;
  strokes: NormalizedStroke[];
}

const RESAMPLE_N = 8;

let indexedCache: IndexedGraphic[] | null = null;
let indexedCount = 0;

export function invalidateHandwritingIndex(): void {
  indexedCache = null;
  indexedCount = 0;
}

function dist(a: StrokePoint, b: StrokePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/**
 * Resample 1 nét vẽ thành đúng N điểm cách đều nhau dọc theo đường đi.
 */
export function resampleStroke(raw: StrokePoint[], n = RESAMPLE_N): StrokePoint[] {
  if (raw.length === 0) return [];
  if (raw.length === 1) return Array.from({ length: n }, () => ({ ...raw[0] }));

  let totalLen = 0;
  for (let i = 1; i < raw.length; i++) {
    totalLen += dist(raw[i - 1], raw[i]);
  }
  if (totalLen < 1e-6) {
    return Array.from({ length: n }, () => ({ ...raw[0] }));
  }

  const step = totalLen / (n - 1);
  const out: StrokePoint[] = [{ ...raw[0] }];
  let accum = 0;
  let prev = { ...raw[0] };

  for (let i = 1; i < raw.length; i++) {
    let curr = { ...raw[i] };
    let segLen = dist(prev, curr);
    while (accum + segLen >= step && out.length < n) {
      const t = (step - accum) / Math.max(segLen, 1e-6);
      const nx = prev.x + t * (curr.x - prev.x);
      const ny = prev.y + t * (curr.y - prev.y);
      const np = { x: nx, y: ny };
      out.push(np);
      prev = np;
      segLen = dist(prev, curr);
      accum = 0;
    }
    accum += segLen;
    prev = curr;
  }

  while (out.length < n) {
    out.push({ ...raw[raw.length - 1] });
  }
  return out;
}

/**
 * Chuẩn hóa toàn bộ tập nét của 1 chữ vào khung [0..1]x[0..1] (giữ tỷ lệ khung hình),
 * đồng nhất hệ trục Y hướng xuống dưới để so khớp trực tiếp giữa Canvas và MakeMeAHanzi medians.
 */
export function normalizeStrokeSet(
  rawStrokes: StrokePoint[][],
  invertY = false
): NormalizedStroke[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const transformed = rawStrokes.map((st) =>
    st.map((p) => {
      const x = p.x;
      const y = invertY ? 900 - p.y : p.y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      return { x, y };
    })
  );

  if (!Number.isFinite(minX)) return [];

  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.max(width, height, 1);
  const padX = (scale - width) / 2;
  const padY = (scale - height) / 2;

  return transformed.map((st) => {
    const normPts = st.map((p) => ({
      x: (p.x - minX + padX) / scale,
      y: (p.y - minY + padY) / scale
    }));
    const pts = resampleStroke(normPts, RESAMPLE_N);
    const first = pts[0];
    const last = pts[pts.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const len = Math.hypot(dx, dy);
    return {
      points: pts,
      dirX: len > 1e-4 ? dx / len : 0,
      dirY: len > 1e-4 ? dy / len : 0,
      length: len
    };
  });
}

function strokeDistance(a: NormalizedStroke, b: NormalizedStroke): number {
  let ptDist = 0;
  for (let i = 0; i < RESAMPLE_N; i++) {
    ptDist += dist(a.points[i], b.points[i]);
  }
  ptDist /= RESAMPLE_N;

  // Trọng số thêm cho điểm đầu & điểm cuối nét
  const startEndDist =
    (dist(a.points[0], b.points[0]) +
      dist(a.points[RESAMPLE_N - 1], b.points[RESAMPLE_N - 1])) /
    2;

  // Chênh lệch hướng vector (cosine similarity -> [0..1])
  const dot = a.dirX * b.dirX + a.dirY * b.dirY;
  const dirPenalty = (1 - Math.max(-1, Math.min(1, dot))) * 0.35;

  // Chênh lệch độ dài nét
  const lenPenalty = Math.abs(a.length - b.length) * 0.25;

  return ptDist * 0.55 + startEndDist * 0.3 + dirPenalty + lenPenalty;
}

function compareCharacters(
  user: NormalizedStroke[],
  ref: NormalizedStroke[]
): number {
  const m = user.length;
  const n = ref.length;
  if (m === 0 || n === 0) return Infinity;

  // So khớp theo thứ tự chuẩn (nếu số nét bằng nhau) kết hợp best-match cho phép viết hơi lệch thứ tự nét
  let orderedCost = 0;
  const minCount = Math.min(m, n);
  for (let i = 0; i < minCount; i++) {
    orderedCost += strokeDistance(user[i], ref[i]);
  }
  orderedCost /= minCount;

  // Greedy nearest-stroke matching giúp vẫn nhận ra chữ ngay cả khi người học viết sai thứ tự 1–2 nét
  const used = new Array<boolean>(n).fill(false);
  let flexibleCost = 0;
  for (let i = 0; i < m; i++) {
    let bestJ = -1;
    let bestD = Infinity;
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      const d = strokeDistance(user[i], ref[j]);
      if (d < bestD) {
        bestD = d;
        bestJ = j;
      }
    }
    if (bestJ >= 0) {
      used[bestJ] = true;
      flexibleCost += bestD;
    } else {
      flexibleCost += 0.65;
    }
  }
  flexibleCost /= m;

  const strokeDiffPenalty = Math.abs(m - n) * 0.16;
  return orderedCost * 0.4 + flexibleCost * 0.6 + strokeDiffPenalty;
}

async function getIndexedGraphics(): Promise<IndexedGraphic[]> {
  const total = await db.hanziGraphics.count();
  if (indexedCache && indexedCount === total) {
    return indexedCache;
  }
  const all: HanziGraphic[] = await db.hanziGraphics.toArray();
  const built: IndexedGraphic[] = [];
  for (const g of all) {
    if (!g.medians || g.medians.length === 0) continue;
    const rawStrokes: StrokePoint[][] = g.medians.map((med) =>
      med.map((pt) => ({ x: pt[0], y: pt[1] }))
    );
    // MakeMeAHanzi medians có trục Y hướng lên trên -> invertY = true
    const strokes = normalizeStrokeSet(rawStrokes, true);
    if (strokes.length > 0) {
      built.push({
        char: g.char,
        strokesCount: strokes.length,
        strokes
      });
    }
  }
  indexedCache = built;
  indexedCount = total;
  return built;
}

/**
 * Nhận diện chữ Hán viết tay 100% Offline bằng cách so khớp trực tiếp với MakeMeAHanzi medians.
 * Lọc ứng viên trong khoảng số nét ±2, trả về Top 12 chữ sát nhất.
 */
export async function recognizeHandwritingOffline(
  userStrokes: UserStroke[],
  topK = 12
): Promise<RecognitionCandidate[]> {
  const cleanStrokes = userStrokes.filter((s) => s.length >= 2);
  if (cleanStrokes.length === 0) return [];

  const normUser = normalizeStrokeSet(cleanStrokes, false);
  const strokeCount = normUser.length;
  const allRef = await getIndexedGraphics();

  const minS = Math.max(1, strokeCount - 2);
  const maxS = strokeCount + 2;

  const scored: Array<{ char: string; cost: number; strokesCount: number }> = [];
  for (const ref of allRef) {
    if (ref.strokesCount < minS || ref.strokesCount > maxS) continue;
    const cost = compareCharacters(normUser, ref.strokes);
    scored.push({
      char: ref.char,
      cost,
      strokesCount: ref.strokesCount
    });
  }

  scored.sort((a, b) => a.cost - b.cost);
  return scored.slice(0, topK).map((s) => ({
    char: s.char,
    strokesCount: s.strokesCount,
    score: Math.max(5, Math.min(99, Math.round((1 - Math.min(1, s.cost / 1.15)) * 100)))
  }));
}

/**
 * Pure helper dùng để kiểm thử thuật toán so khớp trực tiếp không cần IndexedDB.
 */
export function matchAgainstReferences(
  userStrokes: UserStroke[],
  references: Array<{ char: string; medians: number[][][] }>,
  topK = 12
): RecognitionCandidate[] {
  const clean = userStrokes.filter((s) => s.length >= 2);
  if (clean.length === 0) return [];
  const normUser = normalizeStrokeSet(clean, false);
  const count = normUser.length;

  const scored = references
    .filter((r) => Math.abs(r.medians.length - count) <= 2)
    .map((r) => {
      const refStrokes = normalizeStrokeSet(
        r.medians.map((m) => m.map((p) => ({ x: p[0], y: p[1] }))),
        true
      );
      return {
        char: r.char,
        strokesCount: refStrokes.length,
        cost: compareCharacters(normUser, refStrokes)
      };
    })
    .sort((a, b) => a.cost - b.cost);

  return scored.slice(0, topK).map((s) => ({
    char: s.char,
    strokesCount: s.strokesCount,
    score: Math.max(5, Math.min(99, Math.round((1 - Math.min(1, s.cost / 1.15)) * 100)))
  }));
}
