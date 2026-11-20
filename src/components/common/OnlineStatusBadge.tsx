import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';

export const OnlineStatusBadge: React.FC = () => {
  const isOnline = useAppStore((s) => s.isOnline);
  const hasKey = useAppStore((s) => Boolean(s.settings.geminiApiKey));

  if (!isOnline) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 px-2.5 py-1 text-xs font-medium border border-amber-200 dark:border-amber-800"
        title="Đang hoạt động ở chế độ Offline — Từ điển, vẽ tay, FSRS, trò chơi và dữ liệu AI đã cache vẫn hoạt động bình thường"
      >
        <WifiOff className="w-3.5 h-3.5" />
        <span>Offline</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-1 text-xs font-medium border border-emerald-200 dark:border-emerald-800"
      title={
        hasKey
          ? 'Đang trực tuyến & đã sẵn sàng Google Gemini API'
          : 'Đang trực tuyến (chưa nhập Gemini API Key — vẫn dùng tốt mọi tính năng Offline)'
      }
    >
      <Wifi className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{hasKey ? 'Online · AI sẵn sàng' : 'Online'}</span>
    </span>
  );
};
