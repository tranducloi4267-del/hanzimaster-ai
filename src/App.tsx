import React, { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  autoLoadBundledFullDatabaseIfAvailable,
  ensureCoreDatabaseSeeded
} from '@/db/seed';
import { startConnectivityMonitor } from '@/services/network/connectivityService';
import { useAppStore } from '@/stores/useAppStore';
import { AppShell } from '@/components/layout/AppShell';
import { QuickSearchModal } from '@/components/layout/QuickSearchModal';
import { OnboardingModal } from '@/components/common/OnboardingModal';
import { ShadowingModal } from '@/components/common/ShadowingModal';
import { ToastContainer } from '@/components/common/ToastContainer';
import { DailyLessonPage } from '@/features/daily-lesson/DailyLessonPage';
import { DictionaryPage } from '@/features/dictionary/DictionaryPage';
import { ArcadeHubPage } from '@/features/arcade/ArcadeHubPage';
import { AiTutorPage } from '@/features/ai-tutor/AiTutorPage';
import { LibraryAndExamsHubPage } from '@/features/library/LibraryAndExamsHubPage';
import { StatsPage } from '@/features/stats/StatsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Lỗi không xác định' };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-center">
          <div className="max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-3">
            <h1 className="text-lg font-bold text-rose-600">Đã xảy ra lỗi hiển thị</h1>
            <p className="text-xs text-slate-500">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-brand-600 text-white px-4 py-2 text-xs font-bold"
            >
              Tải lại ứng dụng
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App: React.FC = () => {
  const {
    initApp,
    dbReady,
    setDbReady,
    seedProgress,
    setSeedProgress,
    setFullDbProgress,
    updateSettings,
    pushToast
  } = useAppStore();

  useEffect(() => {
    const stopMonitor = startConnectivityMonitor();

    (async () => {
      await initApp();
      setSeedProgress({ active: true, percent: 10, message: 'Đang mở cơ sở dữ liệu cục bộ...' });
      await ensureCoreDatabaseSeeded((percent, message) => {
        setSeedProgress({ active: percent < 100, percent, message });
      });
      setSeedProgress({ active: false, percent: 100, message: '' });
      setDbReady(true);

      // Tự động giải nén & nạp ngầm kho từ điển mở rộng (>9.500 chữ) đóng gói sẵn ngay lần đầu cài đặt!
      const autoRes = await autoLoadBundledFullDatabaseIfAvailable((p) => {
        setFullDbProgress({
          active: p.type === 'PROGRESS',
          percent: p.percent,
          message: p.message
        });
      });
      setFullDbProgress({ active: false, percent: 100, message: '' });
      if (autoRes.loaded) {
        await updateSettings({
          fullDictLoaded: true,
          fullDictCount: autoRes.dictCount
        });
        pushToast(
          `Đã sẵn sàng kho từ điển mở rộng (${autoRes.dictCount.toLocaleString('vi-VN')} từ & ${autoRes.graphicsCount.toLocaleString('vi-VN')} nét chữ Offline)!`,
          'success'
        );
      }
    })();

    return () => {
      stopMonitor();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dbReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-rose-500 text-white flex items-center justify-center font-hanzi text-4xl font-bold shadow-lg mb-4">
          汉
        </div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">HanziMaster AI</h1>
        <p className="text-xs text-slate-500 mt-1 mb-5">
          {seedProgress.message || 'Đang chuẩn bị kho từ điển & nét vẽ Offline...'}
        </p>
        <div className="w-64 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-3">
          <div
            className="h-full bg-brand-600 transition-all duration-300"
            style={{ width: `${Math.max(8, seedProgress.percent)}%` }}
          />
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <RootErrorBoundary>
      <HashRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<DailyLessonPage />} />
            <Route path="/dictionary" element={<DictionaryPage />} />
            <Route path="/arcade" element={<ArcadeHubPage />} />
            <Route path="/tutor" element={<AiTutorPage />} />
            <Route path="/library" element={<LibraryAndExamsHubPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
        <QuickSearchModal />
        <OnboardingModal />
        <ShadowingModal />
        <ToastContainer />
      </HashRouter>
    </RootErrorBoundary>
  );
};

export default App;
