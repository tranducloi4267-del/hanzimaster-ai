import React from 'react';
import { Eye, EyeOff, Flame, ShieldAlert } from 'lucide-react';
import { useDisplayStore } from '@/stores/useDisplayStore';

interface DisplayControlBarProps {
  compact?: boolean;
  showHardcoreToggle?: boolean;
  className?: string;
}

/**
 * Thanh công cụ Anti-Crutch (Ẩn/Hiện toàn cục) xuất hiện nhất quán ở mọi màn hình học.
 * 3 nút bật/tắt độc lập: Pinyin, Dịch nghĩa, Hán-Việt + tùy chọn Hardcore.
 */
export const DisplayControlBar: React.FC<DisplayControlBarProps> = ({
  compact = false,
  showHardcoreToggle = false,
  className = ''
}) => {
  const {
    showPinyin,
    showMeaning,
    showHanViet,
    hardcoreMode,
    defaultHideInPractice,
    togglePinyin,
    toggleMeaning,
    toggleHanViet,
    setHardcoreMode,
    setDefaultHideInPractice
  } = useDisplayStore();

  const btnBase =
    'inline-flex items-center gap-1.5 rounded-full text-xs font-medium transition-all active:scale-95 border select-none';
  const pad = compact ? 'px-2.5 py-1' : 'px-3 py-1.5';

  const activeCls =
    'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-950/60 dark:border-brand-800 dark:text-brand-300';
  const hiddenCls =
    'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-400';

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 px-2.5 py-1.5 shadow-sm backdrop-blur ${className}`}
    >
      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
        <ShieldAlert className="w-3.5 h-3.5 text-brand-500" />
        Chống lệ thuộc
      </span>

      <button
        type="button"
        onClick={togglePinyin}
        className={`${btnBase} ${pad} ${showPinyin ? activeCls : hiddenCls}`}
        title="Ẩn/Hiện Pinyin toàn cục (Phím tắt: Ctrl+P)"
      >
        {showPinyin ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        <span>Pinyin</span>
      </button>

      <button
        type="button"
        onClick={toggleMeaning}
        className={`${btnBase} ${pad} ${showMeaning ? activeCls : hiddenCls}`}
        title="Ẩn/Hiện Dịch nghĩa toàn cục (Phím tắt: Ctrl+M)"
      >
        {showMeaning ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        <span>Dịch nghĩa</span>
      </button>

      <button
        type="button"
        onClick={toggleHanViet}
        className={`${btnBase} ${pad} ${showHanViet ? activeCls : hiddenCls}`}
        title="Ẩn/Hiện âm Hán-Việt toàn cục"
      >
        {showHanViet ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        <span>Hán-Việt</span>
      </button>

      {showHardcoreToggle && (
        <button
          type="button"
          onClick={() => setHardcoreMode(!hardcoreMode)}
          className={`${btnBase} ${pad} ${
            hardcoreMode
              ? 'bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-500/30'
              : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
          }`}
          title="Chế độ Hardcore: Ẩn hoàn toàn Pinyin & Nghĩa — Thưởng x2 EXP & cộng thưởng ổn định FSRS"
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Hardcore {hardcoreMode ? 'BẬT (x2 EXP)' : ''}</span>
        </button>
      )}

      {!compact && (
        <label className="ml-auto hidden md:inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={defaultHideInPractice}
            onChange={(e) => setDefaultHideInPractice(e.target.checked)}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span>Ẩn mặc định khi ôn tập</span>
        </label>
      )}
    </div>
  );
};
