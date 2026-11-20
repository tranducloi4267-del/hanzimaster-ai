import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Volume2, X } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { searchDictionary } from '@/services/dictionary/dictionaryService';
import { speakChinese } from '@/services/tts/ttsService';
import type { DictionaryEntry } from '@/types';

/**
 * Hộp tra cứu siêu tốc kích hoạt toàn cục bằng phím tắt Ctrl+K (hoặc nút trên Header).
 */
export const QuickSearchModal: React.FC = () => {
  const navigate = useNavigate();
  const { quickSearchOpen, setQuickSearchOpen, openSplitWord } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (quickSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQuery('');
    }
  }, [quickSearchOpen]);

  useEffect(() => {
    if (!quickSearchOpen) return;
    let cancelled = false;
    searchDictionary({ query, limit: 15 }).then((items) => {
      if (!cancelled) setResults(items);
    });
    return () => {
      cancelled = true;
    };
  }, [query, quickSearchOpen]);

  if (!quickSearchOpen) return null;

  const handleOpen = (entry: DictionaryEntry) => {
    setQuickSearchOpen(false);
    if (window.innerWidth >= 1024) {
      openSplitWord(entry.id, 'word');
    } else {
      navigate(`/dictionary?word=${encodeURIComponent(entry.id)}`);
    }
  };

  return (
    <div
      onClick={() => setQuickSearchOpen(false)}
      className="fixed inset-0 z-[92] bg-slate-950/60 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-brand-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuickSearchOpen(false);
              if (e.key === 'Enter' && results[0]) handleOpen(results[0]);
            }}
            placeholder="Tra nhanh (<50ms): Chữ Hán, Pinyin (ni3hao3), Hán-Việt, nghĩa Việt..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setQuickSearchOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {results.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Không tìm thấy kết quả phù hợp.
            </div>
          ) : (
            results.map((item) => (
              <div
                key={item.id}
                onClick={() => handleOpen(item)}
                className="cursor-pointer px-4 py-2.5 hover:bg-brand-50/50 dark:hover:bg-brand-950/30 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-hanzi text-xl font-bold">{item.simplified}</span>
                    <span className="text-xs font-semibold text-brand-600">{item.pinyin}</span>
                    {item.hanViet && (
                      <span className="text-[11px] uppercase font-bold text-amber-600">
                        {item.hanViet}
                      </span>
                    )}
                    {item.hskLevel > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        HSK {item.hskLevel}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{item.meanings.join('; ')}</div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakChinese(item.simplified).catch(() => {});
                  }}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Enter để mở · Esc để đóng</span>
          <span>Phím tắt: Ctrl+K Tra nhanh · Ctrl+P Pinyin · Ctrl+M Nghĩa</span>
        </div>
      </div>
    </div>
  );
};
