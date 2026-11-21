import React, { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { checkRealConnectivity } from '@/services/network/connectivityService';

/**
 * Chỉ báo trạng thái Online / Offline luôn hiển thị rõ trên cả Mobile APK & Windows EXE:
 * - Chấm xanh lá (🟢 Online): Kết nối mạng thực tế đang hoạt động.
 * - Chấm vàng (🟡 Offline): Đang ngoại tuyến (mọi tính năng học offline vẫn hoạt động bình thường).
 * Bấm trực tiếp vào để kiểm tra lại kết nối ngay lập tức.
 */
export const OnlineStatusBadge: React.FC = () => {
  const isOnline = useAppStore((s) => s.isOnline);
  const hasKey = useAppStore((s) => Boolean(s.settings.geminiApiKey));
  const pushToast = useAppStore((s) => s.pushToast);
  const [checking, setChecking] = useState(false);

  const handleRecheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const ok = await checkRealConnectivity(4000);
      pushToast(
        ok
          ? hasKey
            ? '🟢 Đang Online — Đã sẵn sàng dùng AI & giọng đọc trực tuyến.'
            : '🟢 Đang Online (chưa nhập Gemini API Key trong Cài đặt).'
          : '🟡 Đang Offline — Dùng tốt Từ điển, Luyện viết, Bài khóa & Trò chơi cục bộ.',
        ok ? 'success' : 'warning'
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleRecheck}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border transition active:scale-95 shrink-0 ${
        isOnline
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
          : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700'
      }`}
      title={
        isOnline
          ? hasKey
            ? 'Đang Online · AI sẵn sàng (Bấm để kiểm tra lại mạng)'
            : 'Đang Online (Bấm để kiểm tra lại mạng)'
          : 'Đang Offline — Bấm để kiểm tra lại kết nối mạng'
      }
      aria-label={isOnline ? 'Trạng thái Online' : 'Trạng thái Offline'}
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {isOnline && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            checking
              ? 'bg-sky-400 animate-pulse'
              : isOnline
                ? 'bg-emerald-500'
                : 'bg-amber-400'
          }`}
        />
      </span>
      <span>{checking ? 'Đang kiểm tra...' : isOnline ? 'Online' : 'Offline'}</span>
    </button>
  );
};
