import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Hammer,
  Lightbulb,
  RotateCcw,
  Swords,
  Volume2,
  X,
  XCircle
} from 'lucide-react';
import type { DictionaryEntry } from '@/types';
import { speakChinese } from '@/services/tts/ttsService';
import { Rating, recordStudyActivity, recordVocabReview } from '@/services/fsrs/fsrsService';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { extractToneNumbers } from '@/utils/pinyin';
import { shuffleArray } from './arcadeUtils';
import { GameNavFooter } from './GameNavFooter';

interface HanziCraftAndToneGameProps {
  words: DictionaryEntry[];
  onFinish: (stats: { correct: number; total: number; exp: number }) => void;
}

interface CraftPuzzle {
  targetChar: string;
  pinyin: string;
  hanViet: string;
  meaningVi: string;
  parts: string[];
  partNamesVi: string[];
  storyVi: string;
}

const CRAFT_PUZZLES: CraftPuzzle[] = [
  { targetChar: '好', pinyin: 'hǎo', hanViet: 'HẢO', meaningVi: 'tốt, khỏe', parts: ['女', '子'], partNamesVi: ['女 (Nữ: phụ nữ)', '子 (Tử: con cái)'], storyVi: 'Người phụ nữ (女) bế đứa con (子) → Gia đình ấm êm, tốt đẹp.' },
  { targetChar: '休', pinyin: 'xiū', hanViet: 'HƯU', meaningVi: 'nghỉ ngơi', parts: ['亻', '木'], partNamesVi: ['亻 (Nhân đứng: con người)', '木 (Mộc: cái cây)'], storyVi: 'Con người (亻) tựa lưng vào gốc cây (木) hóng mát → Nghỉ ngơi.' },
  { targetChar: '明', pinyin: 'míng', hanViet: 'MINH', meaningVi: 'sáng, ngày mai', parts: ['日', '月'], partNamesVi: ['日 (Nhật: mặt trời)', '月 (Nguyệt: mặt trăng)'], storyVi: 'Mặt trời (日) cùng mặt trăng (月) cùng tỏa sáng → Rất sáng rõ, ngày mai.' },
  { targetChar: '问', pinyin: 'wèn', hanViet: 'VẤN', meaningVi: 'hỏi', parts: ['门', '口'], partNamesVi: ['门 (Môn: cánh cửa)', '口 (Khẩu: cái miệng)'], storyVi: 'Ghé miệng (口) qua cánh cửa (门) cất tiếng → Hỏi thăm.' },
  { targetChar: '间', pinyin: 'jiān', hanViet: 'GIAN', meaningVi: 'gian phòng, khoảng thời gian', parts: ['门', '日'], partNamesVi: ['门 (Môn: cánh cửa)', '日 (Nhật: ánh mặt trời)'], storyVi: 'Ánh nắng mặt trời (日) lọt qua khe cửa (门) → Khoảng không gian / thời gian.' },
  { targetChar: '看', pinyin: 'kàn', hanViet: 'KHÁN', meaningVi: 'nhìn, xem', parts: ['手', '目'], partNamesVi: ['手 (Thủ: bàn tay)', '目 (Mục: con mắt)'], storyVi: 'Đưa tay (手) che lên trên đôi mắt (目) nhìn ra xa → Xem, nhìn.' },
  { targetChar: '想', pinyin: 'xiǎng', hanViet: 'TƯỞNG', meaningVi: 'nghĩ, nhớ, muốn', parts: ['相', '心'], partNamesVi: ['相 (Tương: hình bóng)', '心 (Tâm: trái tim)'], storyVi: 'Hình bóng (相) khắc ghi trong trái tim (心) → Nhớ nhung, suy nghĩ.' },
  { targetChar: '妈', pinyin: 'mā', hanViet: 'MÃ / MẸ', meaningVi: 'mẹ', parts: ['女', '马'], partNamesVi: ['女 (Nữ: chỉ nghĩa phụ nữ)', '马 (Mã: gợi âm đọc mā)'], storyVi: 'Chữ Hình thanh: bộ Nữ (女) biểu thị người phụ nữ, chữ Mã (马) gợi âm đọc mā.' },
  { targetChar: '晴', pinyin: 'qíng', hanViet: 'TÌNH', meaningVi: 'trời nắng', parts: ['日', '青'], partNamesVi: ['日 (Nhật: mặt trời)', '青 (Thanh: bầu trời xanh)'], storyVi: 'Mặt trời (日) chiếu sáng bầu trời xanh (青) → Trời nắng đẹp.' },
  { targetChar: '请', pinyin: 'qǐng', hanViet: 'THỈNH', meaningVi: 'xin mời', parts: ['讠', '青'], partNamesVi: ['讠 (Ngôn: lời nói)', '青 (Thanh: gợi âm qǐng)'], storyVi: 'Lời nói (讠) lịch sự kết hợp 青 gợi âm qǐng → Mời, thỉnh cầu.' },
  { targetChar: '吃', pinyin: 'chī', hanViet: 'NGẬT', meaningVi: 'ăn', parts: ['口', '乞'], partNamesVi: ['口 (Khẩu: cái miệng)', '乞 (Khất: cầu xin ăn)'], storyVi: 'Dùng cái miệng (口) ăn thức ăn → Ăn uống.' },
  { targetChar: '男', pinyin: 'nán', hanViet: 'NAM', meaningVi: 'nam giới', parts: ['田', '力'], partNamesVi: ['田 (Điền: ruộng đồng)', '力 (Lực: sức lực)'], storyVi: 'Người dùng sức lực (力) cày cấy ngoài ruộng đồng (田) → Đàn ông.' },
  { targetChar: '安', pinyin: 'ān', hanViet: 'AN', meaningVi: 'an toàn, bình yên', parts: ['宀', '女'], partNamesVi: ['宀 (Miên: mái nhà)', '女 (Nữ: người phụ nữ)'], storyVi: 'Người phụ nữ (女) bình yên dưới mái nhà (宀) → An lành.' },
  { targetChar: '坐', pinyin: 'zuò', hanViet: 'TỌA', meaningVi: 'ngồi', parts: ['从', '土'], partNamesVi: ['从 (Tòng: hai người)', '土 (Thổ: nền đất)'], storyVi: 'Hai người (从) cùng ngồi trên gò đất (土) trò chuyện → Ngồi.' },
  { targetChar: '信', pinyin: 'xìn', hanViet: 'TÍN', meaningVi: 'tin tưởng, thư tín', parts: ['亻', '言'], partNamesVi: ['亻 (Nhân đứng: con người)', '言 (Ngôn: lời nói)'], storyVi: 'Lời nói (言) của một người (亻) giữ đúng hẹn → Chữ Tín.' },
  { targetChar: '体', pinyin: 'tǐ', hanViet: 'THỂ', meaningVi: 'cơ thể', parts: ['亻', '本'], partNamesVi: ['亻 (Nhân đứng: con người)', '本 (Bản: gốc rễ)'], storyVi: 'Con người (亻) lấy thân thể làm gốc rễ (本) → Cơ thể.' }
];

const EXTRA_PARTS = ['氵', '火', '口', '女', '木', '日', '月', '心', '亻', '讠', '门', '土', '目', '手', '子'];

function classifyToneGesture(pts: Array<{ x: number; y: number }>): 1 | 2 | 3 | 4 {
  if (pts.length < 3) return 1;
  const ys = pts.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = maxY - minY;
  const startY = ys[0];
  const endY = ys[ys.length - 1];
  const midIdx = ys.indexOf(maxY);

  if (spanY < 26) return 1;
  const isDipInMiddle =
    midIdx > Math.floor(pts.length * 0.15) &&
    midIdx < Math.ceil(pts.length * 0.85) &&
    maxY - startY > 18 &&
    maxY - endY > 18;
  if (isDipInMiddle) return 3;
  if (startY - endY > 22) return 2;
  if (endY - startY > 22) return 4;
  return 1;
}

const TONE_DESC: Record<number, { symbol: string; name: string; tipVi: string }> = {
  1: { symbol: '—', name: 'Thanh 1 (ngang cao)', tipVi: 'Đọc cao, đều và kéo phẳng từ đầu đến cuối (cao độ 5-5), tương ứng dấu ngang ā.' },
  2: { symbol: '↗', name: 'Thanh 2 (đi lên)', tipVi: 'Giọng đi vút từ trung bình lên cao (3-5), giống dấu sắc á trong tiếng Việt.' },
  3: { symbol: '∨', name: 'Thanh 3 (xuống rồi lên)', tipVi: 'Hạ giọng trầm xuống rồi nhẹ nhàng uốn lên (2-1-4), giống dấu hỏi ǎ.' },
  4: { symbol: '↘', name: 'Thanh 4 (dốc xuống)', tipVi: 'Đọc dứt khoát, nhấn mạnh rơi nhanh từ cao xuống thấp (5-1), giống dấu huyền mạnh à.' }
};

interface CraftHistoryEntry {
  selectedParts: string[];
  result: 'correct' | 'wrong';
}

interface ToneHistoryEntry {
  correct: boolean;
  detected: number;
  expected: number;
}

/**
 * Game 4: Lò rèn Bộ thủ (Hanzi Craft) & Chém Thanh điệu (Tone Slash)
 * Đã nâng cấp toàn diện:
 * - Chạm trực tiếp ô đã chọn để gỡ bộ thủ chọn nhầm + nút Xóa chọn lại
 * - KHÔNG tự nhảy câu nhanh — dừng lại giải thích chiết tự chi tiết
 * - Hỗ trợ "Làm lại câu này", "← Câu trước", "Câu tiếp theo →"
 */
export const HanziCraftAndToneGame: React.FC<HanziCraftAndToneGameProps> = ({
  words,
  onFinish
}) => {
  const hardcoreMode = useDisplayStore((s) => s.hardcoreMode);
  const [subMode, setSubMode] = useState<'craft' | 'tone'>('craft');

  // Craft state + per-question history
  const craftDeck = useMemo(() => shuffleArray(CRAFT_PUZZLES).slice(0, 8), []);
  const [craftIdx, setCraftIdx] = useState(0);
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [craftHistory, setCraftHistory] = useState<Record<number, CraftHistoryEntry>>({});

  // Tone Slash state + per-question history
  const toneDeck = useMemo(() => {
    const valid = words.filter((w) => {
      const t = extractToneNumbers(w.pinyin)[0];
      return t >= 1 && t <= 4;
    });
    return shuffleArray(valid).slice(0, 8);
  }, [words]);
  const [toneIdx, setToneIdx] = useState(0);
  const [toneHistory, setToneHistory] = useState<Record<number, ToneHistoryEntry>>({});

  const [totalExp, setTotalExp] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const swipePtsRef = useRef<Array<{ x: number; y: number }>>([]);
  const swipingRef = useRef(false);

  const currentCraft = craftDeck[craftIdx];
  const craftEntry = craftHistory[craftIdx] || null;
  const craftResult = craftEntry?.result || null;

  // Giữ nguyên bộ 6 ô chọn cố định theo từng câu hỏi (không xáo lại khi bấm quay lại câu trước)
  const craftPools = useMemo(
    () =>
      craftDeck.map((puzzle) => {
        const extras = shuffleArray(
          EXTRA_PARTS.filter((p) => !puzzle.parts.includes(p))
        ).slice(0, 4);
        return shuffleArray([...puzzle.parts, ...extras]);
      }),
    [craftDeck]
  );
  const craftPool = craftPools[craftIdx] || [];

  const currentToneWord = toneDeck[toneIdx];
  const toneFeedback = toneHistory[toneIdx] || null;
  const expectedTone = currentToneWord ? extractToneNumbers(currentToneWord.pinyin)[0] : 1;

  // Khi chuyển câu trong Craft, đồng bộ hiển thị selectedParts từ history nếu câu đó đã làm
  useEffect(() => {
    const saved = craftHistory[craftIdx];
    setSelectedParts(saved ? saved.selectedParts : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [craftIdx]);

  useEffect(() => {
    if (subMode === 'tone' && currentToneWord && !toneHistory[toneIdx]) {
      speakChinese(currentToneWord.simplified[0], { silentError: true }).catch(() => {});
    }
    swipePtsRef.current = [];
    drawSwipe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subMode, toneIdx]);

  const handleTogglePart = (p: string) => {
    if (craftResult) return;
    setSelectedParts((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : prev.length < 2 ? [...prev, p] : prev
    );
  };

  const handleRemoveSlot = (slotIdx: number) => {
    if (craftResult) return;
    setSelectedParts((prev) => prev.filter((_, i) => i !== slotIdx));
  };

  const handleForge = async () => {
    if (!currentCraft || selectedParts.length < 2 || craftResult) return;
    const isCorrect = currentCraft.parts.every((p) => selectedParts.includes(p));

    setCraftHistory((prev) => ({
      ...prev,
      [craftIdx]: {
        selectedParts: [...selectedParts],
        result: isCorrect ? 'correct' : 'wrong'
      }
    }));

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
    setTotalExp((e) => e + exp);
    speakChinese(currentCraft.targetChar, { silentError: true }).catch(() => {});
  };

  const handleRetryCraft = () => {
    setCraftHistory((prev) => {
      const next = { ...prev };
      delete next[craftIdx];
      return next;
    });
    setSelectedParts([]);
  };

  const handleNextCraft = async () => {
    if (craftIdx + 1 >= craftDeck.length) {
      const finalCorrect = Object.values(craftHistory).filter((h) => h.result === 'correct').length;
      await recordStudyActivity({ gamesPlayed: 1 });
      onFinish({ correct: finalCorrect, total: craftDeck.length, exp: totalExp });
    } else {
      setCraftIdx((i) => i + 1);
    }
  };

  // Tone Slash Canvas handlers
  const drawSwipe = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
    setToneHistory((prev) => ({
      ...prev,
      [toneIdx]: { correct: isCorrect, detected, expected: expectedTone }
    }));

    const res = await recordVocabReview(
      currentToneWord.id,
      currentToneWord.simplified,
      isCorrect ? Rating.Good : Rating.Again,
      { hardcore: hardcoreMode }
    );
    setTotalExp((e) => e + res.expEarned);
  };

  const handleRetryTone = () => {
    setToneHistory((prev) => {
      const next = { ...prev };
      delete next[toneIdx];
      return next;
    });
    swipePtsRef.current = [];
    drawSwipe();
  };

  const handleNextTone = async () => {
    if (toneIdx + 1 >= toneDeck.length) {
      const finalCorrect = Object.values(toneHistory).filter((h) => h.correct).length;
      await recordStudyActivity({ gamesPlayed: 1 });
      onFinish({ correct: finalCorrect, total: toneDeck.length, exp: totalExp });
    } else {
      setToneIdx((i) => i + 1);
    }
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
              subMode === 'craft'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
            Lò rèn Bộ thủ
          </button>
          <button
            type="button"
            onClick={() => setSubMode('tone')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              subMode === 'tone'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
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

          {/* 2 Ô rèn — Bấm trực tiếp vào ô đã chọn để gỡ ra khi chọn nhầm! */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-3">
              {[0, 1].map((slotIdx) => {
                const val = selectedParts[slotIdx];
                return (
                  <React.Fragment key={slotIdx}>
                    {slotIdx === 1 && <span className="text-xl font-bold text-slate-400">+</span>}
                    <button
                      type="button"
                      disabled={!val || Boolean(craftResult)}
                      onClick={() => handleRemoveSlot(slotIdx)}
                      title={val ? 'Chạm vào ô này để gỡ bộ thủ đã chọn' : 'Ô trống'}
                      className={`relative w-16 h-16 rounded-2xl border-2 border-dashed flex items-center justify-center font-hanzi text-3xl font-bold transition ${
                        val
                          ? 'border-brand-500 bg-brand-50/70 dark:bg-brand-950/50 text-slate-900 dark:text-white hover:border-rose-500'
                          : 'border-brand-300 dark:border-brand-800 bg-brand-50/30 dark:bg-brand-950/20 text-slate-400'
                      }`}
                    >
                      {val || '?'}
                      {val && !craftResult && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow">
                          <X className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  </React.Fragment>
                );
              })}
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
            {!craftResult && selectedParts.length > 0 && (
              <p className="text-[11px] text-slate-400">
                Mẹo: Chọn nhầm? Chạm trực tiếp vào ô trên (hoặc bấm lại bộ thủ màu đỏ bên dưới) để bỏ chọn!
              </p>
            )}
          </div>

          {/* Kho 6 bộ thủ */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-w-md mx-auto">
            {craftPool.map((p) => {
              const active = selectedParts.includes(p);
              const isCorrectPart = currentCraft.parts.includes(p);
              const cls = craftResult
                ? isCorrectPart
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : active
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-45'
                : active
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-400';

              return (
                <button
                  key={p}
                  type="button"
                  disabled={Boolean(craftResult)}
                  onClick={() => handleTogglePart(p)}
                  className={`h-14 rounded-xl border-2 font-hanzi text-2xl font-bold transition active:scale-95 ${cls}`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Nút Chọn lại / Rèn chữ khi chưa nộp */}
          {!craftResult && (
            <div className="flex items-center justify-center gap-2.5">
              {selectedParts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedParts([])}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2.5 text-xs font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Chọn lại</span>
                </button>
              )}
              <button
                type="button"
                disabled={selectedParts.length < 2}
                onClick={handleForge}
                className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 text-sm font-bold shadow-sm disabled:opacity-40"
              >
                Rèn chữ ngay!
              </button>
            </div>
          )}

          {/* Hộp Giải thích chi tiết sau khi rèn (KHÔNG tự nhảy mất!) */}
          {craftResult && (
            <div
              className={`rounded-2xl p-4 text-left text-xs space-y-2 border ${
                craftResult === 'correct'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-100'
                  : 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-sm flex items-center gap-1.5">
                  {craftResult === 'correct' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600" />
                  )}
                  <span>
                    {craftResult === 'correct'
                      ? `Chính xác! ${currentCraft.parts.join(' + ')} → ${currentCraft.targetChar}`
                      : `Bạn chọn (${selectedParts.join(' + ')}) chưa đúng — Đáp án đúng là: ${currentCraft.parts.join(' + ')} → ${currentCraft.targetChar}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => speakChinese(currentCraft.targetChar).catch(() => {})}
                  className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/70 text-brand-600 shrink-0"
                  title="Nghe phát âm"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-start gap-1.5 leading-relaxed">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div>
                    <strong>Giải thích vì sao chọn vậy:</strong> Chữ{' '}
                    <span className="font-hanzi text-base font-bold">{currentCraft.targetChar}</span>{' '}
                    ({currentCraft.pinyin} · Hán-Việt: <strong>{currentCraft.hanViet}</strong> —{' '}
                    <em>{currentCraft.meaningVi}</em>) được tạo từ{' '}
                    <strong>{currentCraft.partNamesVi.join(' + ')}</strong>.
                  </div>
                  <p className="opacity-90">{currentCraft.storyVi}</p>
                </div>
              </div>
            </div>
          )}

          <GameNavFooter
            currentIndex={craftIdx}
            total={craftDeck.length}
            canGoPrev={craftIdx > 0}
            canGoNext={Boolean(craftResult)}
            isLast={craftIdx + 1 >= craftDeck.length}
            showRetry={Boolean(craftResult)}
            onPrev={() => setCraftIdx((i) => Math.max(0, i - 1))}
            onRetry={handleRetryCraft}
            onNext={handleNextCraft}
          />
        </div>
      )}

      {/* Chế độ B: Chém Thanh điệu (Tone Slash Canvas) */}
      {subMode === 'tone' && currentToneWord && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 text-center">
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase text-brand-500">
              Nghe âm tiết đầu tiên và vuốt theo nét 4 thanh điệu (— ↗ ∨ ↘)
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
              height={170}
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
              className="w-full h-[170px] block cursor-crosshair touch-none"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-slate-400">
              Vuốt từ trái sang phải theo đường thanh điệu
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
            {([1, 2, 3, 4] as const).map((t) => {
              const isRight = toneFeedback && t === toneFeedback.expected;
              const isWrongPick = toneFeedback && !toneFeedback.correct && t === toneFeedback.detected;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={Boolean(toneFeedback)}
                  onClick={() => evaluateTone(t)}
                  className={`rounded-xl border-2 py-2 text-center transition active:scale-95 ${
                    isRight
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : isWrongPick
                        ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'border-slate-200 dark:border-slate-700 hover:border-brand-500'
                  }`}
                >
                  <div className="text-xl font-bold text-brand-600">{TONE_DESC[t].symbol}</div>
                  <div className="text-[11px] font-semibold">Thanh {t}</div>
                </button>
              );
            })}
          </div>

          {toneFeedback && (
            <div
              className={`rounded-2xl p-4 text-left text-xs space-y-1.5 border ${
                toneFeedback.correct
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-100'
                  : 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-100'
              }`}
            >
              <div className="font-bold text-sm flex items-center gap-1.5">
                {toneFeedback.correct ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                <span>
                  {toneFeedback.correct
                    ? `Chính xác! ${currentToneWord.simplified} (${currentToneWord.pinyin}) mang ${TONE_DESC[toneFeedback.expected].name}`
                    : `Bạn chọn Thanh ${toneFeedback.detected} — Đáp án đúng là ${TONE_DESC[toneFeedback.expected].name} (${currentToneWord.pinyin})`}
                </span>
              </div>
              <p className="leading-relaxed">
                <strong>Giải thích thanh điệu:</strong> {TONE_DESC[toneFeedback.expected].tipVi} Nghĩa của từ{' '}
                <strong className="font-hanzi text-sm">{currentToneWord.simplified}</strong>: {currentToneWord.meanings.join('; ')}.
              </p>
            </div>
          )}

          <GameNavFooter
            currentIndex={toneIdx}
            total={toneDeck.length}
            canGoPrev={toneIdx > 0}
            canGoNext={Boolean(toneFeedback)}
            isLast={toneIdx + 1 >= toneDeck.length}
            showRetry={Boolean(toneFeedback)}
            onPrev={() => setToneIdx((i) => Math.max(0, i - 1))}
            onRetry={handleRetryTone}
            onNext={handleNextTone}
          />
        </div>
      )}
    </div>
  );
};
