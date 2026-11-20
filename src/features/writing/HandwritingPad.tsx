import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Sparkles, Undo2, Loader2 } from 'lucide-react';
import {
  recognizeHandwritingOffline,
  type RecognitionCandidate,
  type UserStroke
} from '@/services/handwriting/matcher';
import { recognizeHandwritingVisionAI } from '@/services/ai/aiTasks';
import { useAppStore } from '@/stores/useAppStore';

interface HandwritingPadProps {
  onSelectChar: (char: string) => void;
  compact?: boolean;
  height?: number;
  clearOnSelect?: boolean;
}

/**
 * Bảng vẽ tay nhận diện chữ Hán cực sát như Hanzii.net:
 * - Lưới chữ Mễ (米字格), hỗ trợ chuột, cảm ứng Android và bút stylus (Pointer Events).
 * - Nhận diện Offline 100% tức thì khi nhấc bút (so khớp MakeMeAHanzi medians) -> Top 12 chữ sát nhất.
 * - Nút "Nhận diện siêu chuẩn (AI)" gửi ảnh Canvas sang Gemini Vision khi online.
 */
export const HandwritingPad: React.FC<HandwritingPadProps> = ({
  onSelectChar,
  compact = false,
  height = 240,
  clearOnSelect = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<UserStroke[]>([]);
  const activeStrokeRef = useRef<UserStroke | null>(null);
  const isDrawingRef = useRef(false);

  const [strokeCount, setStrokeCount] = useState(0);
  const [candidates, setCandidates] = useState<RecognitionCandidate[]>([]);
  const [aiCandidates, setAiCandidates] = useState<string[]>([]);
  const [autoRecognize, setAutoRecognize] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  const { isOnline, pushToast } = useAppStore();

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isDark = document.documentElement.classList.contains('dark');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, canvas.width * 0.018);
    ctx.strokeStyle = isDark ? '#f8fafc' : '#0f172a';

    const drawOne = (stroke: UserStroke) => {
      if (stroke.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      if (stroke.length === 1) {
        ctx.lineTo(stroke[0].x + 0.1, stroke[0].y + 0.1);
      } else {
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
      }
      ctx.stroke();
    };

    for (const s of strokesRef.current) drawOne(s);
    if (activeStrokeRef.current) drawOne(activeStrokeRef.current);
  }, []);

  // Resize canvas crisply to match display size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(200, Math.round(rect.width * dpr));
    const h = Math.max(180, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      redraw();
    }
  }, [height, redraw]);

  const runOfflineRecognition = useCallback(async () => {
    if (strokesRef.current.length === 0) {
      setCandidates([]);
      return;
    }
    const res = await recognizeHandwritingOffline(strokesRef.current, 12);
    setCandidates(res);
  }, []);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pt = getCanvasPoint(e);
    activeStrokeRef.current = [pt];
    redraw();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !activeStrokeRef.current) return;
    e.preventDefault();
    const pt = getCanvasPoint(e);
    const last = activeStrokeRef.current[activeStrokeRef.current.length - 1];
    if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 2.5) {
      activeStrokeRef.current.push(pt);
      redraw();
    }
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    isDrawingRef.current = false;
    if (activeStrokeRef.current && activeStrokeRef.current.length >= 2) {
      strokesRef.current = [...strokesRef.current, activeStrokeRef.current];
      setStrokeCount(strokesRef.current.length);
      setAiCandidates([]);
    }
    activeStrokeRef.current = null;
    redraw();
    if (autoRecognize) {
      await runOfflineRecognition();
    }
  };

  const handleUndo = async () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    setAiCandidates([]);
    redraw();
    if (autoRecognize) {
      await runOfflineRecognition();
    }
  };

  const handleClear = () => {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    setStrokeCount(0);
    setCandidates([]);
    setAiCandidates([]);
    redraw();
  };

  const handlePickChar = (ch: string) => {
    onSelectChar(ch);
    if (clearOnSelect) {
      handleClear();
    }
  };

  const handleAiVision = async () => {
    const canvas = canvasRef.current;
    if (!canvas || strokesRef.current.length === 0) {
      pushToast('Hãy viết một chữ lên bảng trước khi nhận diện AI.', 'info');
      return;
    }
    if (!isOnline) {
      pushToast('Đang Offline — vui lòng dùng kết quả nhận diện cục bộ phía trên.', 'warning');
      return;
    }
    setAiLoading(true);
    try {
      // Export white-background crisp image for Gemini Vision
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const tctx = tmp.getContext('2d')!;
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      tctx.lineCap = 'round';
      tctx.lineJoin = 'round';
      tctx.lineWidth = Math.max(5, tmp.width * 0.022);
      tctx.strokeStyle = '#000000';
      for (const s of strokesRef.current) {
        if (s.length < 2) continue;
        tctx.beginPath();
        tctx.moveTo(s[0].x, s[0].y);
        for (let i = 1; i < s.length; i++) tctx.lineTo(s[i].x, s[i].y);
        tctx.stroke();
      }
      const res = await recognizeHandwritingVisionAI(tmp.toDataURL('image/png'));
      setAiCandidates(res);
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : 'Lỗi nhận diện AI Vision',
        'error'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const displayChars =
    aiCandidates.length > 0
      ? aiCandidates.map((c) => ({ char: c, score: 99, fromAi: true }))
      : candidates.map((c) => ({ char: c.char, score: c.score, fromAi: false }));

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm">
      {/* Thanh ứng viên chữ nhận diện */}
      <div className="min-h-[44px] mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-1">
        {displayChars.length === 0 ? (
          <span className="text-xs text-slate-400 px-1">
            Vẽ chữ Hán vào ô chữ Mễ bên dưới (chạm liên tiếp các chữ gợi ý để ghép thành từ)...
          </span>
        ) : (
          displayChars.map((item, idx) => (
            <button
              key={`${item.char}-${idx}`}
              type="button"
              onClick={() => handlePickChar(item.char)}
              className={`shrink-0 flex flex-col items-center justify-center min-w-[44px] h-11 rounded-xl border font-hanzi text-xl font-bold transition active:scale-95 ${
                idx === 0
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:border-brand-400'
              }`}
              title={
                item.fromAi
                  ? 'Gợi ý từ Gemini Vision AI'
                  : `Độ khớp cục bộ: ${item.score}%`
              }
            >
              <span>{item.char}</span>
            </button>
          ))
        )}
      </div>

      {/* Bảng vẽ lưới chữ Mễ 米字格 */}
      <div
        className="relative w-full rounded-xl border-2 border-dashed border-brand-300/70 dark:border-brand-800/70 bg-slate-50/70 dark:bg-slate-950/60 mi-grid overflow-hidden touch-none select-none"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full block cursor-crosshair touch-none"
        />
        <span className="pointer-events-none absolute top-2 left-2.5 text-[11px] font-medium text-slate-400">
          {strokeCount} nét
        </span>
      </div>

      {/* Thanh công cụ bảng vẽ */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleUndo}
          disabled={strokeCount === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Hoàn tác nét</span>
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={strokeCount === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>Xóa</span>
        </button>

        {!compact && (
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRecognize}
              onChange={(e) => setAutoRecognize(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>Tự nhận diện</span>
          </label>
        )}

        {!autoRecognize && strokeCount > 0 && (
          <button
            type="button"
            onClick={runOfflineRecognition}
            className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-2.5 py-1.5 text-xs font-semibold"
          >
            Nhận diện
          </button>
        )}

        <button
          type="button"
          onClick={handleAiVision}
          disabled={aiLoading || strokeCount === 0}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-rose-500 hover:from-brand-700 hover:to-rose-600 text-white px-3 py-1.5 text-xs font-semibold shadow-sm disabled:opacity-40 transition"
          title="Gửi ảnh bảng vẽ cho Gemini Vision nhận diện khi viết ngoáy hoặc chữ phức tạp"
        >
          {aiLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>Nhận diện siêu chuẩn (AI)</span>
        </button>
      </div>
    </div>
  );
};
