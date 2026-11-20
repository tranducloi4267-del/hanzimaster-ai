import React, { useState } from 'react';
import { BookOpen, KeyRound, Sparkles, WifiOff } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';

export const OnboardingModal: React.FC = () => {
  const { settings, settingsLoaded, updateSettings, pushToast } = useAppStore();
  const [level, setLevel] = useState(settings.targetHskLevel || 1);
  const [goal, setGoal] = useState(settings.dailyWordGoal || 10);
  const [apiKey, setApiKey] = useState(settings.geminiApiKey || '');

  if (!settingsLoaded || settings.onboardingCompleted) return null;

  const finish = async (skipKey: boolean) => {
    await updateSettings({
      targetHskLevel: level,
      dailyWordGoal: goal,
      geminiApiKey: skipKey ? '' : apiKey.trim(),
      onboardingCompleted: true
    });
    pushToast(
      skipKey || !apiKey.trim()
        ? 'Chào mừng đến với HanziMaster AI! Bạn đang học ở chế độ Offline-First 0đ.'
        : 'Đã lưu cấu hình & Gemini API Key cục bộ. Chúc bạn học tốt!',
      'success'
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-brand-600 to-rose-500 p-6 text-white">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-hanzi text-2xl font-bold">
              汉
            </div>
            <div>
              <h2 className="text-xl font-bold">Chào mừng đến với HanziMaster AI</h2>
              <p className="text-xs text-rose-100">
                Học tiếng Trung Giản thể All-in-One • Offline-First • 0đ vận hành
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-semibold mb-2">
              1. Trình độ HSK mục tiêu của bạn
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevel(lv)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition ${
                    level === lv
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                  }`}
                >
                  HSK {lv}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold">2. Số từ mục tiêu mỗi ngày</label>
              <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
                {goal} từ / ngày
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
              <span>5 (Nhẹ nhàng)</span>
              <span>15–20 (Tiêu chuẩn)</span>
              <span>50 (Tăng tốc)</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center gap-2 text-sm font-semibold mb-1.5">
              <KeyRound className="w-4 h-4 text-brand-500" />
              <span>3. Google Gemini API Key miễn phí (Tùy chọn)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5 leading-relaxed">
              Dán key miễn phí từ{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 dark:text-brand-400 underline font-medium"
              >
                Google AI Studio
              </a>{' '}
              để mở khóa Gia sư AI, tạo bài khóa hàng ngày, OCR tài liệu & giải đề HSK (mặc định
              dùng model mới nhất <code className="font-mono">gemini-3.8-flash</code>). Key chỉ
              lưu cục bộ trên thiết bị này.
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy... (có thể để trống và nhập sau trong Cài đặt)"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => finish(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <WifiOff className="w-4 h-4" />
              Bỏ qua — Dùng Offline ngay
            </button>
            <button
              type="button"
              onClick={() => finish(false)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 text-sm font-semibold shadow-sm transition"
            >
              {apiKey.trim() ? <Sparkles className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
              Bắt đầu học ngay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
