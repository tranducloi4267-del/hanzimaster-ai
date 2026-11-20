import React, { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  FolderKanban,
  Gamepad2,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Settings,
  Sun
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { OnlineStatusBadge } from '@/components/common/OnlineStatusBadge';
import { SplitViewPane } from './SplitViewPane';

const PRIMARY_TABS = [
  { to: '/', label: 'Hôm nay', shortLabel: 'Hôm nay', icon: CalendarDays },
  { to: '/dictionary', label: 'Từ điển & Viết', shortLabel: 'Từ điển', icon: BookOpen },
  { to: '/arcade', label: 'Trò chơi (Arcade)', shortLabel: 'Trò chơi', icon: Gamepad2 },
  { to: '/tutor', label: 'Gia sư AI', shortLabel: 'Gia sư AI', icon: Bot },
  { to: '/library', label: 'Kho & Đề thi', shortLabel: 'Kho & Đề', icon: FolderKanban }
];

const SECONDARY_LINKS = [
  { to: '/stats', label: 'Thống kê & Sổ từ', icon: BarChart3 },
  { to: '/settings', label: 'Cài đặt', icon: Settings }
];

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    settings,
    updateSettings,
    splitView,
    openSplitDictionary,
    closeSplitView,
    setQuickSearchOpen,
    quickSearchOpen,
    shadowingTarget,
    closeShadowing,
    pushToast
  } = useAppStore();

  const { togglePinyin, toggleMeaning } = useDisplayStore();

  // Phím tắt Windows/Desktop toàn cục: Ctrl+K, Ctrl+P, Ctrl+M
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        setQuickSearchOpen(!useAppStore.getState().quickSearchOpen);
      } else if (key === 'p') {
        e.preventDefault();
        togglePinyin();
        const next = useDisplayStore.getState().showPinyin;
        pushToast(next ? 'Đã HIỆN Pinyin toàn ứng dụng (Ctrl+P)' : 'Đã ẨN Pinyin toàn ứng dụng (Ctrl+P)', 'info');
      } else if (key === 'm') {
        e.preventDefault();
        toggleMeaning();
        const next = useDisplayStore.getState().showMeaning;
        pushToast(
          next ? 'Đã HIỆN Dịch nghĩa toàn ứng dụng (Ctrl+M)' : 'Đã ẨN Dịch nghĩa toàn ứng dụng (Ctrl+M)',
          'info'
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setQuickSearchOpen, togglePinyin, toggleMeaning, pushToast]);

  // Xử lý nút Back vật lý chuẩn trên Android (Capacitor 7)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | null = null;
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (shadowingTarget) {
        closeShadowing();
      } else if (quickSearchOpen) {
        setQuickSearchOpen(false);
      } else if (location.pathname !== '/' && canGoBack) {
        navigate(-1);
      } else if (location.pathname !== '/') {
        navigate('/');
      } else {
        CapacitorApp.exitApp();
      }
    }).then((h) => {
      handle = h;
    });
    return () => {
      handle?.remove();
    };
  }, [shadowingTarget, quickSearchOpen, location.pathname, navigate, closeShadowing, setQuickSearchOpen]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar (>= 768px) */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-rose-500 text-white flex items-center justify-center font-hanzi text-xl font-bold shadow-sm">
            汉
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-sm leading-tight truncate">HanziMaster AI</div>
            <div className="text-[10px] font-semibold text-slate-400">Offline-First · 0đ Server</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {PRIMARY_TABS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
            {SECONDARY_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 space-y-0.5">
          <div>
            Phím tắt: <kbd className="font-mono font-bold">Ctrl+K</kbd> Tra nhanh
          </div>
          <div>
            <kbd className="font-mono font-bold">Ctrl+P</kbd> Pinyin ·{' '}
            <kbd className="font-mono font-bold">Ctrl+M</kbd> Nghĩa
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar (Safe Area aware for Android notch) */}
        <header className="pt-safe shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-30">
          <div className="h-14 px-3 sm:px-5 flex items-center justify-between gap-2">
            {/* Mobile Brand */}
            <div className="flex md:hidden items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-rose-500 text-white flex items-center justify-center font-hanzi text-lg font-bold">
                汉
              </div>
              <span className="font-extrabold text-sm">HanziMaster</span>
            </div>

            {/* Quick Search trigger */}
            <button
              type="button"
              onClick={() => setQuickSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-brand-400 px-3 py-1.5 text-xs text-slate-500 w-64 lg:w-80 transition"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="flex-1 text-left truncate">Tra nhanh từ điển...</span>
              <kbd className="hidden lg:inline px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-[10px] font-mono font-bold">
                Ctrl+K
              </kbd>
            </button>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <OnlineStatusBadge />

              <button
                type="button"
                onClick={() => setQuickSearchOpen(true)}
                className="sm:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                aria-label="Tra nhanh"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Desktop Split-View Toggle */}
              <button
                type="button"
                onClick={() => (splitView.open ? closeSplitView() : openSplitDictionary())}
                className={`hidden lg:inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  splitView.open
                    ? 'bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-950/60 dark:border-brand-700 dark:text-brand-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Chia đôi màn hình: Mở song song Từ điển / Luyện viết bên phải"
              >
                {splitView.open ? (
                  <PanelRightClose className="w-4 h-4" />
                ) : (
                  <PanelRightOpen className="w-4 h-4" />
                )}
                <span>Split-View</span>
              </button>

              {/* Light / Dark Toggle */}
              <button
                type="button"
                onClick={() =>
                  updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
                }
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                title="Chuyển Light / Dark Mode"
              >
                {settings.theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              {/* Mobile Stats & Settings quick buttons */}
              <NavLink
                to="/stats"
                className={({ isActive }) =>
                  `md:hidden p-2 rounded-xl ${
                    isActive
                      ? 'bg-brand-50 text-brand-600 dark:bg-brand-950'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
                aria-label="Thống kê"
              >
                <BarChart3 className="w-4 h-4" />
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `md:hidden p-2 rounded-xl ${
                    isActive
                      ? 'bg-brand-50 text-brand-600 dark:bg-brand-950'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
                aria-label="Cài đặt"
              >
                <Settings className="w-4 h-4" />
              </NavLink>
            </div>
          </div>
        </header>

        {/* Workspace + Optional Desktop Split-View */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 sm:py-5 pb-24 md:pb-8">
            <div className="max-w-6xl mx-auto">{children}</div>
          </main>

          <SplitViewPane />
        </div>

        {/* Mobile 1-Hand Bottom Tab Bar (5 mục) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur pb-safe">
          <div className="grid grid-cols-5 h-16">
            {PRIMARY_TABS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition ${
                      isActive
                        ? 'text-brand-600 dark:text-brand-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.shortLabel}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};
