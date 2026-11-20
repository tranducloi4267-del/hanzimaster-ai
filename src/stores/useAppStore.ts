import { create } from 'zustand';
import { db, getSetting, setSetting } from '@/db/database';
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type ShadowingTarget
} from '@/types';
import { getTodayDateString } from '@/utils/pinyin';

export interface ToastItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface SplitViewState {
  open: boolean;
  mode: 'dictionary' | 'word' | 'writing';
  wordId?: string;
  char?: string;
  searchQuery?: string;
}

export interface AppState {
  settings: AppSettings;
  settingsLoaded: boolean;
  isOnline: boolean;
  dbReady: boolean;
  seedProgress: { active: boolean; percent: number; message: string };
  splitView: SplitViewState;
  quickSearchOpen: boolean;
  shadowingTarget: ShadowingTarget | null;
  toasts: ToastItem[];
  activeArcadeLessonId: string | null;

  initApp: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  incrementAiCallCount: () => Promise<void>;
  setOnline: (val: boolean) => void;
  setDbReady: (val: boolean) => void;
  setSeedProgress: (progress: { active: boolean; percent: number; message: string }) => void;
  openSplitWord: (wordId: string, mode?: 'word' | 'writing', char?: string) => void;
  openSplitDictionary: (searchQuery?: string) => void;
  closeSplitView: () => void;
  setQuickSearchOpen: (open: boolean) => void;
  openShadowing: (target: ShadowingTarget) => void;
  closeShadowing: () => void;
  setActiveArcadeLessonId: (lessonId: string | null) => void;
  pushToast: (message: string, type?: ToastItem['type']) => void;
  dismissToast: (id: string) => void;
}

async function encryptApiKeyIfElectron(plain: string): Promise<string> {
  if (!plain) return '';
  if (typeof window !== 'undefined' && window.electronAPI?.encryptSecret) {
    try {
      return await window.electronAPI.encryptSecret(plain);
    } catch {
      return plain;
    }
  }
  return plain;
}

async function decryptApiKeyIfElectron(stored: string): Promise<string> {
  if (!stored) return '';
  if (typeof window !== 'undefined' && window.electronAPI?.decryptSecret) {
    try {
      return await window.electronAPI.decryptSecret(stored);
    } catch {
      return stored;
    }
  }
  return stored;
}

function applyThemeToDom(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const useAppStore = create<AppState>()((set, get) => ({
  settings: DEFAULT_APP_SETTINGS,
  settingsLoaded: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  dbReady: false,
  seedProgress: { active: false, percent: 0, message: '' },
  splitView: { open: false, mode: 'dictionary' },
  quickSearchOpen: false,
  shadowingTarget: null,
  toasts: [],
  activeArcadeLessonId: null,

  initApp: async () => {
    try {
      const stored = await getSetting<Partial<AppSettings>>('appSettings', {});
      const rawKey = await getSetting<string>('geminiApiKeyEncrypted', stored.geminiApiKey || '');
      const decryptedKey = await decryptApiKeyIfElectron(rawKey);
      const today = getTodayDateString();
      const merged: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        ...stored,
        geminiApiKey: decryptedKey,
        dailyAiCallCount: stored.dailyAiCallDate === today ? stored.dailyAiCallCount || 0 : 0,
        dailyAiCallDate: today
      };
      applyThemeToDom(merged.theme);
      set({ settings: merged, settingsLoaded: true });
    } catch {
      applyThemeToDom(DEFAULT_APP_SETTINGS.theme);
      set({ settings: DEFAULT_APP_SETTINGS, settingsLoaded: true });
    }
  },

  updateSettings: async (patch) => {
    const prev = get().settings;
    const next: AppSettings = { ...prev, ...patch };
    if (patch.theme) {
      applyThemeToDom(patch.theme);
    }
    set({ settings: next });

    // Persist API key separately (encrypted via Electron DPAPI when available)
    if (patch.geminiApiKey !== undefined) {
      const enc = await encryptApiKeyIfElectron(patch.geminiApiKey.trim());
      await setSetting('geminiApiKeyEncrypted', enc);
    }
    const { geminiApiKey: _omitKey, ...safeToStore } = next;
    await setSetting('appSettings', safeToStore);
  },

  incrementAiCallCount: async () => {
    const today = getTodayDateString();
    const cur = get().settings;
    const nextCount = cur.dailyAiCallDate === today ? cur.dailyAiCallCount + 1 : 1;
    await get().updateSettings({ dailyAiCallDate: today, dailyAiCallCount: nextCount });
  },

  setOnline: (val) => set({ isOnline: val }),
  setDbReady: (val) => set({ dbReady: val }),
  setSeedProgress: (seedProgress) => set({ seedProgress }),

  openSplitWord: (wordId, mode = 'word', char) =>
    set({ splitView: { open: true, mode, wordId, char } }),
  openSplitDictionary: (searchQuery) =>
    set({ splitView: { open: true, mode: 'dictionary', searchQuery } }),
  closeSplitView: () => set((s) => ({ splitView: { ...s.splitView, open: false } })),
  setQuickSearchOpen: (open) => set({ quickSearchOpen: open }),
  openShadowing: (target) => set({ shadowingTarget: target }),
  closeShadowing: () => set({ shadowingTarget: null }),
  setActiveArcadeLessonId: (lessonId) => set({ activeArcadeLessonId: lessonId }),

  pushToast: (message, type = 'info') => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, type, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3800);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}));

export async function getDictionaryCount(): Promise<number> {
  return db.dictionary.count();
}
