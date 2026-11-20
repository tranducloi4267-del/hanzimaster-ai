import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Hammer, Swords, Volume2, XCircle } from 'lucide-react';
import type { DictionaryEntry } from '@/types';
import { speakChinese } from '@/services/tts/ttsService';
import { Rating, recordStudyActivity, recordVocabReview } from '@/services/fsrs/fsrsService';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { extractToneNumbers } from '@/utils/pinyin';
import { shuffleArray } from './arcadeUtils';

interface HanziCraftAndToneGameProps {
  words: DictionaryEntry[];
  onFinish: (stats: { correct: number; total: number; exp: number }) => void;
}

interface CraftPuzzle {
  targetChar: string;
  pinyin: string;
  meaningVi: string;
  parts: string[];
  storyVi: string;
}

const CRAFT_PUZZLES: CraftPuzzle[] = [
  { targetChar: '好', pinyin: 'hǎo', meaningVi: 'tốt, khỏe', parts: ['女', '子'], storyVi: 'Người phụ nữ (女) bế đứa con (子) → Hạnh phúc, tốt đẹp.' },
  { targetChar: '休', pinyin: 'xiū', meaningVi: 'nghỉ ngơi', parts: ['亻', '木'], storyVi: 'Con người (亻) tựa lưng vào gốc cây (木) → Nghỉ ngơi.' },
  { targetChar: '明', pinyin: 'míng', meaningVi: 'sáng, ngày mai', parts: ['日', '月'], storyVi: 'Mặt trời (日) cùng mặt trăng (月) tỏa sáng → Rất sáng rõ.' },
  { targetChar: '问', pinyin: 'wèn', meaningVi: 'hỏi', parts: ['门', '口'], storyVi: 'Ghém miệng (口) qua cánh cửa (门) → Hỏi thăm.' },
  { targetChar: '间', pinyin: 'jiān', meaningVi: 'gian phòng, khoảng thời gian', parts: ['门', '日'], storyVi: 'Ánh mặt trời (日) lọt qua khe cửa (门) → Gian phòng / Thời gian.' },
  { targetChar: '看', pinyin: 'kàn', meaningVi: 'nhìn, xem', parts: ['手', '目'], storyVi: 'Đưa tay (手) che trên đôi mắt (目) nhìn ra xa → Xem, nhìn.' },
  { targetChar: '想', pinyin: 'xiǎng', meaningVi: 'nghĩ, nhớ, muốn', parts: ['相', '心'], storyVi: 'Hình bóng (相) khắc ghi trong trái tim (心) → Nhớ nhung, suy nghĩ.' },
  { targetChar: '妈', pinyin: 'mā', meaningVi: 'mẹ', parts: ['女', '马'], storyVi: 'Bộ Nữ (女) chỉ người phụ nữ + chữ Mã (马) gợi âm đọc mā.' },
  { targetChar: '晴', pinyin: 'qíng', meaningVi: 'trời nắng', parts: ['日', '青'], storyVi: 'Mặt trời (日) chiếu sáng bầu trời xanh (青) → Trời nắng đẹp.' },
  { targetChar: '请', pinyin: 'qǐng', meaningVi: 'xin mời', parts: ['讠', '青'], storyVi: 'Lời nói (讠) lịch sự + 青 gợi âm qǐng → Mời.' },
  { targetChar: '吃', pinyin: 'chī', meaningVi: 'ăn', parts: ['口', '乞'], storyVi: 'Cái miệng (口) ăn thức ăn → Ăn uống.' },
  { targetChar: '男', pinyin: 'nán', meaningVi: 'nam giới', parts: ['田', '力'], storyVi: 'Người dùng sức lực (力) cày cấy ngoài ruộng đồng (田) → Đàn ông.' },
  { targetChar: '安', pinyin: 'ān', meaningVi: 'an toàn, bình yên', parts: ['宀', '女'], storyVi: 'Người phụ nữ (女) ở yên bình dưới mái nhà (宀) → Bình an.' },
  { targetChar: '坐', pinyin: 'zuò', meaningVi: 'ngồi', parts: ['从', '土'], storyVi: 'Hai người (从) cùng ngồi trên gò đất (土) → Ngồi.' },
  { targetChar: '信', pinyin: 'xìn', meaningVi: 'tin tưởng, thư tín', parts: ['亻', '言'], storyVi: 'Lời nói (言) của một người (亻) đáng tin cậy → Chữ Tín.' },
  { targetChar: '体', pinyin: 'tǐ', meaningVi: 'cơ thể', parts: ['亻', '本'], storyVi: 'Con người (亻) lấy thân thể làm gốc rễ (本) → Cơ thể.' }
];

const EXTRA_PARTS = ['氵', '火', '口', '女', '木', '日', '月', '心', '亻', '讠', '门', '土', '目', '手', '子'];

/**
 * Phân loại đường vuốt tay trên Canvas thành 1 trong 4 thanh điệu tiếng Trung:
 * 1: Ngang (—) | 2: Đi lên (/) | 3: Xuống rồi lên (v) | 4: Dốc xuống (\)
 */
function classifyToneGesture(pts: Array<{ x: number; y: number }>): 1 | 2 | 3 | 4 {
  if (pts.length < 3) return 1;
  const ys = pts.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = maxY - minY;
  const startY = ys[0];
  const endY = ys[ys.length - 1];
  const midIdx = ys.indexOf(maxY); // Canvas Y lớn hơn là thấp hơn (đáy chữ V)

  // Vuốt tương đối phẳng -> Thanh 1 (—)
  if (spanY < 26) return 1;

  // Có điểm võng xuống ở giữa rồi đi ngược lên rõ rệt -> Thanh 3 (v)
  const isDipInMiddle =
    midIdx > Math.floor(pts.length * 0.15) &&
    midIdx < Math.ceil(pts.length * 0.85) &&
    maxY - startY > 18 &&
    maxY - endY > 18;
  if (isDipInMiddle) return 3;

  // Kết thúc cao hơn điểm đầu (Y nhỏ hơn) -> Thanh 2 (/)
  if (startY - endY > 22) return 2;

  // Kết thúc thấp hơn điểm đầu (Y lớn hơn) -> Thanh 4 (\)
  if (endY - startY > 22) return 4;

  return 1;
}

const TONE_DESC: Record<number, { symbol: string; name: string }> = {
  1: { symbol: '—', name: 'Thanh 1 (ngang cao)' },
  2: { symbol: '↗', name: 'Thanh 2 (đi lên)' },
  3: { symbol: '∨', name: 'Thanh 3 (xuống rồi lên)' },
  4: { symbol: '↘', name: 'Thanh 4 (dốc xuống)' }
};

/**
 * Game 4: Dual Coding & Mnemonics — Lò rèn Bộ thủ (Hanzi Craft) & Chém Thanh điệu (Tone Slash)
 */
export const HanziCraftAndToneGame: React.FC<HanziCraftAndToneGameProps> = ({
  words,
  onFinish
}) => {
  const hardcoreMode = useDisplayStore((s) => s.hardcoreMode);
  const [subMode, setSubMode] = useState<'craft' | 'tone'>('craft');

  // Craft state
  const craftDeck = useMemo(() => shuffleArray(CRAFT_PUZZLES).slice(0, 8), []);
  const [craftIdx, setCraftIdx] = useState(0);
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [craftResult, setCraftResult] = useState<'correct' | 'wrong' | null>(null);

  // Tone Slash state
  const toneDeck = useMemo(() => {
    const valid = words.filter((w) => {
      const t = extractToneNumbers(w.pinyin)[0];
      return t >= 1 && t <= 4;
    });
    return shuffleArray(valid).slice(0, 8);
  }, [words]);
  const [toneIdx, setToneIdx] = useState(0);
  const [toneFeedback, setToneFeedback] = useState<{
    correct: boolean;
    detected: number;
    expected: number;
  } | null>(null);

  const [correctCount, setCorrectCount] = useState(0);
  const [totalExp, setTotalExp] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const swipePtsRef = useRef<Array<{ x: number; y: number }>>([]);
  const swipingRef = useRef(false);

  const currentCraft = craftDeck[craftIdx];
  const craftPool = useMemo(() => {
    if (!currentCraft) return [];
    const extras = shuffleArray(
      EXTRA_PARTS.filter((p) => !currentCraft.parts.includes(p))
    ).slice(0, 4);
    return shuffleArray([...currentCraft.parts, ...extras]);
  }, [currentCraft]);

  const currentToneWord = toneDeck[toneIdx];
  const expectedTone = currentToneWord ? extractToneNumbers(currentToneWord.pinyin)[0] : 1;

  useEffect(() => {
    if (subMode === 'tone' && currentToneWord) {
      speakChinese(currentToneWord.simplified[0]).catch(() => {});
    }
  }, [subMode, currentToneWord]);

  const handleTogglePart = (p: string) => {
    if (craftResult) return;
    setSelectedParts((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : prev.length < 2 ? [...prev, p] : prev
    );
  };

  const handleForge = async () => {
    if (!currentCraft || selectedParts.length < 2 || craftResult) return;
    const isCorrect = currentCraft.parts.every((p) => selectedParts.includes(p));
    setCraftResult(isCorrect ? 'correct' : 'wrong');

    const matchedWord = words.find((w) => w.simplified === currentCraft.targetChar);
    let exp = isCorrect ? (hardcoreMode ? 20 : 10) : 2;
    if (matchedWord) {
      const res = await recordVocabReview(
        matchedWord.id,
        matchedWord.simplified,
        isCorrect ? Rating.Good : Rating.Again,
        { hardcore: hardcoreMode }
      );
      exp = res.expEarned;
    }
    const nextCorrect = isCorrect ? correctCount + 1 : correctCount;
    const nextExp = totalExp + exp;
    setCorrectCount(nextCorrect);
    setTotalExp(nextExp);

    speakChinese(currentCraft.targetChar).catch(() => {});

    window.setTimeout(async () => {
      if (craftIdx + 1 >= craftDeck.length) {
        await recordStudyActivity({ gamesPlayed: 1 });
        onFinish({ correct: nextCorrect, total: craftDeck.length, exp: nextExp });
      } else {
        setCraftIdx((i) => i + 1);
        setSelectedParts([]);
        setCraftResult(null);
      }
    }, 1500);
  };

  // Tone Slash Canvas handlers
  const drawSwipe = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Reference guide lines
    ctx.strokeStyle = 'rgba(148,163,184,0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    [0.25, 0.5, 0.75].forEach((r) => {
      ctx.beginPath();
      ctx.moveTo(0, canvas.height * r);
      ctx.lineTo(canvas.width, canvas.height * r);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    const pts = swipePtsRef.current;
    if (pts.length < 2) return;
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  };

  const evaluateTone = async (detected: 1 | 2 | 3 | 4) => {
    if (!currentToneWord || toneFeedback) return;
    const isCorrect = detected === expectedTone;
    setToneFeedback({ correct: isCorrect, detected, expected: expectedTone });

    const res = await recordVocabReview(
      currentToneWord.id,
      currentToneWord.simplified,
      isCorrect ? Rating.Good : Rating.Again,
      { hardcore: hardcoreMode }
    );
    const nextCorrect = isCorrect ? correctCount + 1 : correctCount;
    const nextExp = totalExp + res.expEarned;
    setCorrectCount(nextCorrect);
    setTotalExp(nextExp);

    window.setTimeout(async () => {
      swipePtsRef.current = [];
      drawSwipe();
      if (toneIdx + 1 >= toneDeck.length) {
        await recordStudyActivity({ gamesPlayed: 1 });
        onFinish({ correct: nextCorrect, total: toneDeck.length, exp: nextExp });
      } else {
        setToneIdx((i) => i + 1);
        setToneFeedback(null);
      }
    }, 1200);
  };

  const getPt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / Math.max(1, r.width)) * c.width,
      y: ((e.clientY - r.top) / Math.max(1, r.height)) * c.height
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          <button
            type="button"
            onClick={() => setSubMode('craft')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              subMode === 'craft' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
            Lò rèn Bộ thủ
          </button>
          <button
            type="button"
            onClick={() => setSubMode('tone')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              subMode === 'tone' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            Chém Thanh điệu
          </button>
        </div>
        <span className="text-xs font-bold text-slate-500">
          {subMode === 'craft'
            ? `Chữ ${craftIdx + 1}/${craftDeck.length}`
            : `Âm ${toneIdx + 1}/${toneDeck.length}`}
        </span>
      </div>

      {/* Chế độ A: Lò rèn Bộ thủ */}
      {subMode === 'craft' && currentCraft && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-5 text-center">
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-brand-500">
              Chọn đúng 2 bộ thủ để rèn thành chữ:
            </p>
            <div className="mt-2 text-2xl font-bold">
              "{currentCraft.meaningVi}"
              {!hardcoreMode && (
                <span className="ml-2 text-base text-brand-600">({currentCraft.pinyin})</span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-500 max-w-md mx-auto">
              Gợi ý chiết tự: {currentCraft.storyVi.replace(currentCraft.targetChar, '？')}
            </p>
          </div>

          {/* Ô rèn */}
          <div className="flex items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-brand-400 flex items-center justify-center font-hanzi text-3xl font-bold bg-brand-50/40 dark:bg-brand-950/30">
              {selectedParts[0] || '?'}
            </div>
            <span className="text-xl font-bold text-slate-400">+</span>
            <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-brand-400 flex items-center justify-center font-hanzi text-3xl font-bold bg-brand-50/40 dark:bg-brand-950/30">
              {selectedParts[1] || '?'}
            </div>
            <span className="text-xl font-bold text-slate-400">→</span>
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center font-hanzi text-4xl font-bold ${
                craftResult === 'correct'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : craftResult === 'wrong'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}
            >
              {craftResult ? currentCraft.targetChar : '？'}
            </div>
          </div>

          {/* Kho bộ thủ */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-w-md mx-auto">
            {craftPool.map((p) => {
              const active = selectedParts.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleTogglePart(p)}
                  className={`h-14 rounded-xl border-2 font-hanzi text-2xl font-bold transition active:scale-95 ${
                    active
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {craftResult && (
            <div
              className={`rounded-xl px-4 py-2.5 text-xs font-semibold ${
                craftResult === 'correct'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              }`}
            >
              {currentCraft.parts.join(' + ')} →{' '}
              <span className="font-hanzi text-base font-bold">{currentCraft.targetChar}</span>:{' '}
              {currentCraft.storyVi}
            </div>
          )}

          <button
            type="button"
            disabled={selectedParts.length < 2 || Boolean(craftResult)}
            onClick={handleForge}
            className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 text-sm font-bold shadow-sm disabled:opacity-40"
          >
            Rèn chữ ngay!
          </button>
        </div>
      )}

      {/* Chế độ B: Chém Thanh điệu (Tone Slash Canvas) */}
      {subMode === 'tone' && currentToneWord && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 text-center">
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase text-brand-500">
              Nghe âm tiết đầu tiên và vuốt theo nét 4 thanh điệu (— / ∨ \)
            </p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <span className="font-hanzi text-5xl font-bold">
                {currentToneWord.simplified[0]}
              </span>
              <button
                type="button"
                onClick={() => speakChinese(currentToneWord.simplified[0]).catch(() => {})}
                className="w-12 h-12 rounded-full bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center shadow-md active:scale-95"
                title="Nghe lại âm tiết"
              >
                <Volume2 className="w-6 h-6" />
              </button>
            </div>
            {!hardcoreMode && (
              <div className="text-sm text-slate-500">{currentToneWord.meanings[0]}</div>
            )}
          </div>

          <div className="relative max-w-md mx-auto rounded-2xl border-2 border-dashed border-brand-300 dark:border-brand-800 bg-slate-50 dark:bg-slate-950 overflow-hidden touch-none select-none">
            <canvas
              ref={canvasRef}
              width={400}
              height={180}
              onPointerDown={(e) => {
                if (toneFeedback) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                swipingRef.current = true;
                swipePtsRef.current = [getPt(e)];
                drawSwipe();
              }}
              onPointerMove={(e) => {
                if (!swipingRef.current) return;
                swipePtsRef.current.push(getPt(e));
                drawSwipe();
              }}
              onPointerUp={() => {
                if (!swipingRef.current) return;
                swipingRef.current = false;
                const detected = classifyToneGesture(swipePtsRef.current);
                evaluateTone(detected);
              }}
              className="w-full h-[180px] block cursor-crosshair touch-none"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-slate-400">
              Vuốt từ trái sang phải theo đường thanh điệu
            </span>
          </div>

          {/* Nút dự phòng chạm nhanh 4 thanh cho bàn phím/1 tay */}
          <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
            {([1, 2, 3, 4] as const).map((t) => (
              <button
                key={t}
                type="button"
                disabled={Boolean(toneFeedback)}
                onClick={() => evaluateTone(t)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 py-2 text-center transition active:scale-95"
              >
                <div className="text-xl font-bold text-brand-600">{TONE_DESC[t].symbol}</div>
                <div className="text-[11px] font-semibold">Thanh {t}</div>
              </button>
            ))}
          </div>

          {toneFeedback && (
            <div
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 ${
                toneFeedback.correct
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
              }`}
            >
              {toneFeedback.correct ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              <span>
                {toneFeedback.correct
                  ? `Chém chuẩn ${TONE_DESC[toneFeedback.expected].name}! (${currentToneWord.pinyin})`
                  : `Bạn vuốt Thanh ${toneFeedback.detected} — Đáp án đúng là ${TONE_DESC[toneFeedback.expected].name} (${currentToneWord.pinyin})`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
