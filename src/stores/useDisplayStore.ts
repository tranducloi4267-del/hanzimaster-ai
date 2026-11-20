import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DisplayState {
  showPinyin: boolean;
  showMeaning: boolean;
  showHanViet: boolean;
  defaultHideInPractice: boolean;
  hardcoreMode: boolean;

  togglePinyin: () => void;
  toggleMeaning: () => void;
  toggleHanViet: () => void;
  setDefaultHideInPractice: (val: boolean) => void;
  setHardcoreMode: (val: boolean) => void;
  applyPracticeDefaults: () => void;
  showAll: () => void;
  hideAllCrutches: () => void;
}

export const useDisplayStore = create<DisplayState>()(
  persist(
    (set, get) => ({
      showPinyin: true,
      showMeaning: true,
      showHanViet: true,
      defaultHideInPractice: true,
      hardcoreMode: false,

      togglePinyin: () => set((s) => ({ showPinyin: !s.showPinyin, hardcoreMode: false })),
      toggleMeaning: () => set((s) => ({ showMeaning: !s.showMeaning, hardcoreMode: false })),
      toggleHanViet: () => set((s) => ({ showHanViet: !s.showHanViet })),
      setDefaultHideInPractice: (val) => set({ defaultHideInPractice: val }),
      setHardcoreMode: (val) =>
        set((s) => ({
          hardcoreMode: val,
          showPinyin: val ? false : s.showPinyin,
          showMeaning: val ? false : s.showMeaning,
          showHanViet: val ? false : s.showHanViet
        })),
      applyPracticeDefaults: () => {
        if (get().defaultHideInPractice) {
          set({ showPinyin: false, showMeaning: false });
        }
      },
      showAll: () =>
        set({ showPinyin: true, showMeaning: true, showHanViet: true, hardcoreMode: false }),
      hideAllCrutches: () =>
        set({ showPinyin: false, showMeaning: false, showHanViet: false })
    }),
    {
      name: 'hanzimaster-display-v1'
    }
  )
);
