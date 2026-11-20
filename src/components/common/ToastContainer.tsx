import React from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';

export const ToastContainer: React.FC = () => {
  const toasts = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-5 right-4 z-[90] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map((t) => {
        const styles =
          t.type === 'success'
            ? 'bg-emerald-600 text-white'
            : t.type === 'error'
              ? 'bg-rose-600 text-white'
              : t.type === 'warning'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-900 text-white dark:bg-slate-800';
        const Icon =
          t.type === 'success'
            ? CheckCircle2
            : t.type === 'error'
              ? AlertCircle
              : t.type === 'warning'
                ? AlertTriangle
                : Info;

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 shadow-lg text-sm font-medium ${styles}`}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="opacity-80 hover:opacity-100 p-0.5"
              aria-label="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
