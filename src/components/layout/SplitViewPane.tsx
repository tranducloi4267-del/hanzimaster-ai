import React, { useEffect, useState } from 'react';
import { BookOpen, PenTool, Search, X } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { searchDictionary } from '@/services/dictionary/dictionaryService';
import type { DictionaryEntry } from '@/types';
import { WordDetailView } from '@/features/dictionary/WordDetailView';
import { HandwritingPad } from '@/features/writing/HandwritingPad';

/**
 * Bảng Split-View bên phải cho Windows/Desktop (>= 1024px):
 * Cho phép mở song song Từ điển / Chi tiết 4 Tab / Vẽ tay nhận diện ngay khi đang học Bài khóa, Chat AI, Làm đề hoặc đọc Tài liệu bên trái.
 */
export const SplitViewPane: React.FC = () => {
  const { splitView, closeSplitView, openSplitWord } = useAppStore();
  const [query, setQuery] = useState(splitView.searchQuery || '');
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [showPad, setShowPad] = useState(false);

  useEffect(() => {
    if (splitView.searchQuery !== undefined) {
      setQuery(splitView.searchQuery);
    }
  }, [splitView.searchQuery]);

  useEffect(() => {
    if (!splitView.open || splitView.mode !== 'dictionary') return;
    let cancelled = false;
    searchDictionary({ query, limit: 25 }).then((items) => {
      if (!cancelled) setResults(items);
    });
    return () => {
      cancelled = true;
    };
  }, [splitView.open, splitView.mode, query]);

  if (!splitView.open) return null;

  return (
    <aside className="hidden lg:flex flex-col w-[450px] xl:w-[500px] shrink-0 border-l border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 h-full overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold">
          <BookOpen className="w-4 h-4 text-brand-600" />
          <span>Split-View · Từ điển & Luyện viết</span>
        </div>

        <div className="flex items-center gap-1">
          {splitView.wordId && (
            <button
              type="button"
              onClick={() => useAppStore.getState().openSplitDictionary(query)}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
            >
              Tra từ khác
            </button>
          )}
          <button
            type="button"
            onClick={closeSplitView}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Đóng Split-View"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {splitView.mode === 'word' && splitView.wordId ? (
          <WordDetailView wordId={splitView.wordId} compact />
        ) : splitView.mode === 'writing' && splitView.wordId ? (
          <WordDetailView wordId={splitView.wordId} initialTab="practice" compact />
        ) : (
          <div className="space-y-3">
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tra nhanh Chữ Hán / Pinyin / Việt..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowPad((v) => !v)}
                className={`px-2.5 py-2 rounded-xl border text-xs font-semibold ${
                  showPad
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                }`}
                title="Bật/tắt bảng vẽ tay"
              >
                <PenTool className="w-4 h-4" />
              </button>
            </div>

            {showPad && (
              <HandwritingPad
                compact
                height={180}
                onSelectChar={(ch) => setQuery((prev) => `${prev}${ch}`)}
              />
            )}

            <div className="space-y-1.5">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openSplitWord(item.id, 'word')}
                  className="w-full text-left rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-400 p-2.5 transition"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-hanzi text-lg font-bold">{item.simplified}</span>
                    <span className="text-xs font-semibold text-brand-600">{item.pinyin}</span>
                    {item.hanViet && (
                      <span className="text-[10px] uppercase text-amber-600 font-bold">
                        {item.hanViet}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                    {item.meanings.join('; ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
