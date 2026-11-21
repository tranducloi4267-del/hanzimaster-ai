import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Filter,
  Flag,
  PenTool,
  Search,
  Volume2,
  X,
  BookOpen
} from 'lucide-react';
import { db } from '@/db/database';
import { searchDictionary } from '@/services/dictionary/dictionaryService';
import { markWordForgotten } from '@/services/fsrs/fsrsService';
import { speakChinese } from '@/services/tts/ttsService';
import { RADICALS_214 } from '@/data/radicals214';
import { useAppStore } from '@/stores/useAppStore';
import type { DictionaryEntry } from '@/types';
import { HandwritingPad } from '@/features/writing/HandwritingPad';
import { WordDetailView } from './WordDetailView';
import { PeekableText } from '@/components/common/PeekableText';

export const DictionaryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const hskStandard = useAppStore((s) => s.settings.hskStandard);
  const pushToast = useAppStore((s) => s.pushToast);

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [hskLevel, setHskLevel] = useState<number>(0);
  const [radical, setRadical] = useState<string>('');
  const [strokesCount, setStrokesCount] = useState<number>(0);
  const [showHandwriting, setShowHandwriting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [forgottenIds, setForgottenIds] = useState<Set<string>>(new Set());
  const [searchTimeMs, setSearchTimeMs] = useState<number>(0);
  const [selectedWordId, setSelectedWordId] = useState<string>(
    searchParams.get('word') || ''
  );

  useEffect(() => {
    db.userVocab
      .filter((v) => Boolean(v.isForgotten || v.isLeech))
      .toArray()
      .then((list) => setForgottenIds(new Set(list.map((x) => x.wordId))));
  }, [selectedWordId]);

  const handleQuickToggleForgotten = async (entry: DictionaryEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const isNowForgotten = !forgottenIds.has(entry.id);
    await markWordForgotten(entry.id, entry.simplified, isNowForgotten, 'forgotten');
    setForgottenIds((prev) => {
      const next = new Set(prev);
      if (isNowForgotten) next.add(entry.id);
      else next.delete(entry.id);
      return next;
    });
    pushToast(
      isNowForgotten
        ? `Đã thêm "${entry.simplified}" vào mục Từ quên theo mức độ!`
        : `Đã gỡ "${entry.simplified}" khỏi Từ quên.`,
      isNowForgotten ? 'warning' : 'info'
    );
  };

  useEffect(() => {
    const paramWord = searchParams.get('word');
    if (paramWord) setSelectedWordId(paramWord);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    searchDictionary({
      query,
      hskLevel: hskLevel || undefined,
      hskStandard,
      radical: radical || undefined,
      strokesCount: strokesCount || undefined,
      limit: 80
    }).then((items) => {
      if (cancelled) return;
      setResults(items);
      setSearchTimeMs(Math.round((performance.now() - start) * 10) / 10);
      if (!selectedWordId && items.length > 0 && window.innerWidth >= 1024) {
        setSelectedWordId(items[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query, hskLevel, hskStandard, radical, strokesCount, selectedWordId]);

  const handleSelectWord = (entry: DictionaryEntry) => {
    setSelectedWordId(entry.id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('word', entry.id);
      return next;
    });
  };

  const maxHsk = hskStandard === 'hsk3' ? 9 : 6;

  return (
    <div className="space-y-4">
      {/* Thanh tìm kiếm siêu tốc & công cụ vẽ tay */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tra Chữ Hán, Pinyin (ni3hao3 / nihao), Hán-Việt hoặc nghĩa tiếng Việt..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                aria-label="Xóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowHandwriting((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold border transition shrink-0 ${
              showHandwriting
                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-400'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span className="hidden sm:inline">Vẽ tay</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold border transition shrink-0 ${
              showFilters || hskLevel > 0 || radical || strokesCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-400'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Bộ lọc</span>
          </button>
        </div>

        {/* Bộ lọc HSK 1–6 / 3.0, 214 Bộ thủ, Số nét */}
        {showFilters && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Cấp độ ({hskStandard === 'hsk3' ? 'HSK 3.0' : 'HSK 1–6'})
              </label>
              <select
                value={hskLevel}
                onChange={(e) => setHskLevel(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
              >
                <option value={0}>Tất cả cấp độ</option>
                {Array.from({ length: maxHsk }, (_, i) => i + 1).map((lv) => (
                  <option key={lv} value={lv}>
                    HSK {lv}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                214 Bộ thủ Khang Hy
              </label>
              <select
                value={radical}
                onChange={(e) => setRadical(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-hanzi"
              >
                <option value="">Tất cả bộ thủ</option>
                {RADICALS_214.map((r) => (
                  <option key={r.id} value={r.radical}>
                    {r.radical} ({r.strokes} nét) — {r.hanViet}: {r.meaningVi}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Số nét chữ đầu
              </label>
              <select
                value={strokesCount}
                onChange={(e) => setStrokesCount(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
              >
                <option value={0}>Mọi số nét</option>
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} nét
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Bảng vẽ tay trực tiếp */}
        {showHandwriting && (
          <HandwritingPad
            onSelectChar={(ch) => setQuery((prev) => `${prev}${ch}`)}
            height={220}
          />
        )}
      </div>

      {/* Bố cục 2 cột (Desktop) / chuyển mượt trên Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Danh sách từ kết quả */}
        <div
          className={`lg:col-span-5 space-y-2 ${
            selectedWordId ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="flex items-center justify-between px-1 text-xs text-slate-500">
            <span>
              Tìm thấy <strong>{results.length}</strong> kết quả ({searchTimeMs} ms · Offline)
            </span>
            {(hskLevel > 0 || radical || strokesCount > 0) && (
              <button
                type="button"
                onClick={() => {
                  setHskLevel(0);
                  setRadical('');
                  setStrokesCount(0);
                }}
                className="text-brand-600 font-semibold hover:underline"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
            {results.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                Không tìm thấy từ phù hợp. Hãy thử tìm không dấu, vẽ tay hoặc nạp thêm Full DB trong
                Cài đặt.
              </div>
            ) : (
              results.map((item) => {
                const active = item.id === selectedWordId;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectWord(item)}
                    className={`cursor-pointer rounded-xl border p-3 transition flex items-start justify-between gap-2 ${
                      active
                        ? 'bg-brand-50/80 dark:bg-brand-950/40 border-brand-400 dark:border-brand-700 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-brand-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-hanzi text-xl font-bold text-slate-900 dark:text-white">
                          {item.simplified}
                        </span>
                        <PeekableText
                          kind="pinyin"
                          inline
                          className="text-xs font-semibold text-brand-600 dark:text-brand-400"
                        >
                          {item.pinyin}
                        </PeekableText>
                        {item.hanViet && (
                          <PeekableText
                            kind="hanviet"
                            inline
                            className="text-[11px] font-semibold uppercase text-amber-700 dark:text-amber-300"
                          >
                            {item.hanViet}
                          </PeekableText>
                        )}
                        {item.hskLevel > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            HSK {item.hskLevel}
                          </span>
                        )}
                      </div>
                      <PeekableText
                        kind="meaning"
                        className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-1"
                      >
                        {item.meanings.join('; ')}
                      </PeekableText>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleQuickToggleForgotten(item, e)}
                        className={`p-2 rounded-lg transition ${
                          forgottenIds.has(item.id)
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-600'
                        }`}
                        title={
                          forgottenIds.has(item.id)
                            ? 'Đã đánh dấu Từ quên (bấm để bỏ)'
                            : 'Thêm vào mục Từ quên theo mức độ'
                        }
                        aria-label={`Đánh dấu quên ${item.simplified}`}
                      >
                        <Flag className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          speakChinese(item.simplified).catch(() => {});
                        }}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-brand-600"
                        aria-label={`Nghe ${item.simplified}`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chi tiết 4 Tab */}
        <div className={`lg:col-span-7 ${selectedWordId ? 'block' : 'hidden lg:block'}`}>
          {selectedWordId && (
            <button
              type="button"
              onClick={() => setSelectedWordId('')}
              className="lg:hidden mb-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600"
            >
              ← Quay lại danh sách tìm kiếm
            </button>
          )}
          <WordDetailView wordId={selectedWordId} />
        </div>
      </div>
    </div>
  );
};
