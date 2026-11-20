import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookmarkCheck,
  BookmarkPlus,
  ExternalLink,
  Mic,
  Volume2,
  X,
  Layers
} from 'lucide-react';
import { db } from '@/db/database';
import { segmentChineseText } from '@/services/dictionary/tokenizer';
import { speakChinese } from '@/services/tts/ttsService';
import { toggleUserVocab } from '@/services/fsrs/fsrsService';
import { useAppStore } from '@/stores/useAppStore';
import { useDisplayStore } from '@/stores/useDisplayStore';
import type { DictionaryEntry, HanziGraphic } from '@/types';
import { isHanziChar } from '@/utils/pinyin';
import { PeekableText } from './PeekableText';

interface InteractiveHanziTextProps {
  text: string;
  highlightWords?: string[];
  className?: string;
  hanziClassName?: string;
  showInlinePinyin?: boolean;
  sentencePinyin?: string;
  sentenceTranslationVi?: string;
  allowShadowing?: boolean;
}

interface LookupData {
  query: string;
  entry: DictionaryEntry | null;
  graphic: HanziGraphic | null;
  saved: boolean;
}

/**
 * Component lõi `<InteractiveHanziText>` dùng xuyên suốt toàn app.
 * Tự tách từ ghép bằng Longest-Match + Intl.Segmenter, hỗ trợ highlight từ mục tiêu
 * và bật Popover Tap-to-Lookup (chuyển nhanh Từ ghép <-> từng chữ đơn cấu tạo).
 */
export const InteractiveHanziText: React.FC<InteractiveHanziTextProps> = ({
  text,
  highlightWords,
  className = '',
  hanziClassName = 'text-lg sm:text-xl leading-relaxed',
  sentencePinyin,
  sentenceTranslationVi,
  allowShadowing = false
}) => {
  const navigate = useNavigate();
  const { openSplitWord, openShadowing, pushToast } = useAppStore();
  const showPinyin = useDisplayStore((s) => s.showPinyin);

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [activeSubQuery, setActiveSubQuery] = useState<string | null>(null);
  const [lookup, setLookup] = useState<LookupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const highlightSet = useMemo(() => new Set(highlightWords || []), [highlightWords]);
  const segments = useMemo(
    () => segmentChineseText(text, highlightWords),
    [text, highlightWords]
  );

  // Close popover on outside click
  useEffect(() => {
    if (!selectedWord) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelectedWord(null);
        setActiveSubQuery(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selectedWord]);

  // Fetch lookup details whenever activeSubQuery changes
  useEffect(() => {
    const query = activeSubQuery || selectedWord;
    if (!query) {
      setLookup(null);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        let entry = (await db.dictionary.where('simplified').equals(query).first()) || null;
        if (!entry && query.length > 1) {
          // Try first character fallback so user still sees useful info
          entry = (await db.dictionary.where('simplified').equals(query[0]).first()) || null;
        }
        const firstChar = Array.from(query).find(isHanziChar) || query[0];
        const graphic = firstChar ? (await db.hanziGraphics.get(firstChar)) || null : null;
        const saved = entry
          ? Boolean(await db.userVocab.where('wordId').equals(entry.id).first())
          : false;

        if (!cancelled) {
          setLookup({ query, entry, graphic, saved });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedWord, activeSubQuery]);

  const handleSegmentClick = (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedWord === word) {
      setSelectedWord(null);
      setActiveSubQuery(null);
    } else {
      setSelectedWord(word);
      setActiveSubQuery(word);
    }
  };

  const handleSpeak = async (spokenText: string) => {
    setSpeaking(true);
    try {
      await speakChinese(spokenText);
    } catch {
      pushToast('Không thể phát âm trên trình duyệt này.', 'warning');
    } finally {
      setSpeaking(false);
    }
  };

  const handleToggleSave = async () => {
    if (!lookup?.entry) {
      pushToast('Từ này chưa có trong kho từ điển hiện tại.', 'info');
      return;
    }
    const res = await toggleUserVocab(lookup.entry.id, lookup.entry.simplified, 'lookup');
    setLookup((prev) => (prev ? { ...prev, saved: res === 'added' } : prev));
    pushToast(
      res === 'added'
        ? `Đã thêm "${lookup.entry.simplified}" vào Sổ ôn FSRS`
        : `Đã bỏ "${lookup.entry.simplified}" khỏi Sổ ôn`,
      res === 'added' ? 'success' : 'info'
    );
  };

  const handleOpenDetail = () => {
    if (!lookup?.entry) return;
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    if (isDesktop) {
      openSplitWord(lookup.entry.id, 'word', lookup.entry.simplified[0]);
    } else {
      navigate(`/dictionary?word=${encodeURIComponent(lookup.entry.id)}`);
    }
    setSelectedWord(null);
  };

  const constituentChars = useMemo(() => {
    if (!selectedWord || selectedWord.length <= 1) return [];
    return Array.from(selectedWord).filter(isHanziChar);
  }, [selectedWord]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className={`font-hanzi tracking-wide break-words ${hanziClassName}`}>
        {segments.map((seg, idx) => {
          if (!seg.isHanzi) {
            return <span key={idx}>{seg.text}</span>;
          }
          const isHighlighted =
            highlightSet.has(seg.text) ||
            (highlightWords || []).some((hw) => hw.length > 0 && seg.text.includes(hw));
          const isSelected = selectedWord === seg.text;

          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => handleSegmentClick(seg.text, e)}
              className={`inline rounded px-0.5 transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-brand-600 text-white shadow-sm'
                  : isHighlighted
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200 font-semibold border-b-2 border-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/70'
                    : 'hover:bg-brand-100/70 dark:hover:bg-brand-900/40 hover:text-brand-700 dark:hover:text-brand-300'
              }`}
              title="Chạm để tra nhanh (Tap-to-Lookup)"
            >
              {seg.text}
            </button>
          );
        })}

        {allowShadowing && (
          <button
            type="button"
            onClick={() =>
              openShadowing({
                hanzi: text,
                pinyin: sentencePinyin,
                translationVi: sentenceTranslationVi
              })
            }
            className="ml-2 inline-flex items-center gap-1 align-middle rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-brand-100 dark:hover:bg-brand-900/40 text-slate-600 dark:text-slate-300 hover:text-brand-700 px-2 py-0.5 text-xs font-sans font-medium transition"
            title="Luyện phát âm & Shadowing câu này"
          >
            <Mic className="w-3 h-3" />
            <span>Shadowing</span>
          </button>
        )}
      </div>

      {sentencePinyin && (
        <PeekableText
          kind="pinyin"
          className={`mt-1 text-sm font-sans text-brand-700 dark:text-brand-300 ${
            showPinyin ? '' : 'inline-block'
          }`}
        >
          {sentencePinyin}
        </PeekableText>
      )}

      {sentenceTranslationVi && (
        <PeekableText
          kind="meaning"
          className="mt-1 text-sm font-sans text-slate-600 dark:text-slate-300"
        >
          {sentenceTranslationVi}
        </PeekableText>
      )}

      {/* Popover Tra Nhanh (Tap-to-Lookup) */}
      {selectedWord && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2 z-40 w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-3.5 text-left font-sans"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="font-hanzi text-2xl font-bold text-slate-900 dark:text-white">
                {lookup?.entry?.simplified || activeSubQuery || selectedWord}
              </span>
              {lookup?.entry && (
                <PeekableText
                  kind="pinyin"
                  inline
                  className="text-sm font-semibold text-brand-600 dark:text-brand-400"
                >
                  {lookup.entry.pinyin}
                </PeekableText>
              )}
              {lookup?.entry?.hanViet && (
                <PeekableText
                  kind="hanviet"
                  inline
                  className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded"
                >
                  {lookup.entry.hanViet}
                </PeekableText>
              )}
              {lookup?.entry && lookup.entry.hskLevel > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  HSK {lookup.entry.hskLevel}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedWord(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Đóng tra nhanh"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Thanh chuyển Từ ghép <-> từng chữ đơn */}
          {constituentChars.length > 1 && (
            <div className="flex items-center gap-1 mt-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveSubQuery(selectedWord)}
                className={`px-2 py-0.5 rounded-md text-xs font-hanzi font-medium transition ${
                  activeSubQuery === selectedWord
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {selectedWord} (từ ghép)
              </button>
              {constituentChars.map((ch, idx) => (
                <button
                  key={`${ch}-${idx}`}
                  type="button"
                  onClick={() => setActiveSubQuery(ch)}
                  className={`px-2 py-0.5 rounded-md text-xs font-hanzi font-semibold transition ${
                    activeSubQuery === ch
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <p className="text-xs text-slate-400 py-2">Đang tra từ điển cục bộ...</p>
          ) : lookup?.entry ? (
            <div className="mt-2 space-y-1.5">
              <PeekableText
                kind="meaning"
                className="text-sm text-slate-700 dark:text-slate-200 leading-snug"
              >
                {lookup.entry.meanings.join(' • ')}
              </PeekableText>

              {lookup.graphic && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                  <span>
                    Cấu tạo:{' '}
                    <span className="font-hanzi text-slate-800 dark:text-slate-200">
                      {lookup.graphic.decomposition}
                    </span>
                    {lookup.graphic.radical ? ` · Bộ ${lookup.graphic.radical}` : ''}
                    {lookup.graphic.etymology?.hint ? ` — ${lookup.graphic.etymology.hint}` : ''}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
              Chưa có trong từ điển lõi ({activeSubQuery}). Bạn có thể chạy{' '}
              <code className="font-mono">npm run build:dict</code> để mở rộng lên &gt;9.500 chữ
              hoặc nghe phát âm trực tiếp.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSpeak(activeSubQuery || selectedWord)}
              disabled={speaking}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
            >
              <Volume2 className={`w-3.5 h-3.5 ${speaking ? 'text-brand-500 animate-pulse' : ''}`} />
              <span>Nghe</span>
            </button>

            {lookup?.entry && (
              <>
                <button
                  type="button"
                  onClick={handleToggleSave}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    lookup.saved
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}
                >
                  {lookup.saved ? (
                    <>
                      <BookmarkCheck className="w-3.5 h-3.5" />
                      <span>Đã trong sổ ôn</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>+ Lưu vào sổ ôn</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenDetail}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
                >
                  <span>Xem chi tiết</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
