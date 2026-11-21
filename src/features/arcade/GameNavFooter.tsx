import React from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';

interface GameNavFooterProps {
  currentIndex: number;
  total: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  isLast: boolean;
  showRetry?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onRetry?: () => void;
  nextLabel?: string;
}

/**
 * Thanh điều hướng chuẩn cho mọi trò chơi trong Memory Arcade:
 * - ← Câu trước (xem lại câu vừa làm & lời giải thích)
 * - Làm lại câu này (khi lỡ chọn sai hoặc muốn thử lại ngay)
 * - Câu tiếp theo → / Hoàn thành ván (tuyệt đối không tự nhảy câu vội vàng!)
 */
export const GameNavFooter: React.FC<GameNavFooterProps> = ({
  currentIndex,
  total,
  canGoPrev,
  canGoNext,
  isLast,
  showRetry = false,
  onPrev,
  onNext,
  onRetry,
  nextLabel
}) => {
  return (
    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        disabled={!canGoPrev}
        onClick={onPrev}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-3.5 py-2 text-xs font-bold disabled:opacity-35 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Câu trước</span>
      </button>

      <div className="flex items-center gap-2">
        {showRetry && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 hover:bg-amber-100 px-3.5 py-2 text-xs font-bold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Làm lại câu này</span>
          </button>
        )}

        <button
          type="button"
          disabled={!canGoNext}
          onClick={onNext}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-xs font-bold shadow-sm disabled:opacity-40 transition active:scale-95"
        >
          {isLast ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>{nextLabel || 'Xem kết quả ván'}</span>
            </>
          ) : (
            <>
              <span>{nextLabel || `Câu tiếp theo (${currentIndex + 2}/${total})`}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
