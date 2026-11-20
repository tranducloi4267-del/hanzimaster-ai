import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Layers,
  Loader2,
  Mic,
  PenTool,
  Sparkles,
  Volume2,
  AlertTriangle
} from 'lucide-react';
import { db } from '@/db/database';
import { parseUsageDetails } from '@/services/dictionary/dictionaryService';
import { speakChinese } from '@/services/tts/ttsService';
import {
  recordStudyActivity,
  setVocabStatus,
  toggleUserVocab
} from '@/services/fsrs/fsrsService';
import { analyzeWordUsageAI, generateMnemonicAI } from '@/services/ai/aiTasks';
import { RADICAL_BY_CHAR } from '@/data/radicals214';
import { CONFUSABLE_GROUPS } from '@/data/confusables';
import { useAppStore } from '@/stores/useAppStore';
import type { DictionaryEntry, HanziGraphic, UsageDetails, UserVocabItem } from '@/types';
import { isHanziChar } from '@/utils/pinyin';
import { DisplayControlBar } from '@/components/common/DisplayControlBar';
import { InteractiveHanziText } from '@/components/common/InteractiveHanziText';
import { PeekableText } from '@/components/common/PeekableText';
import { HanziStrokePlayer } from '@/features/writing/HanziStrokePlayer';

interface WordDetailViewProps {
  wordId: string;
  initialTab?: 'overview' | 'usage' | 'etymology' | 'practice';
  compact?: boolean;
}

const IDS_EXPLANATIONS: Record<string, string> = {
  '⿰': 'Kết cấu Trái – Phải',
  '⿱': 'Kết cấu Trên – Dưới',
  '⿲': 'Kết cấu Trái – Giữa – Phải',
  '⿳': 'Kết cấu Trên – Giữa – Dưới',
  '⿴': 'Kết cấu Bao quanh toàn bộ',
  '⿵': 'Kết cấu Bao trên (hở dưới)',
  '⿶': 'Kết cấu Bao dưới (hở trên)',
  '⿷': 'Kết cấu Bao trái (hở phải)',
  '⿸': 'Kết cấu Bao trên-trái',
  '⿹': 'Kết cấu Bao trên-phải',
  '⿺': 'Kết cấu Bao dưới-trái',
  '⿻': 'Kết cấu Lồng ghép'
};

export const WordDetailView: React.FC<WordDetailViewProps> = ({
  wordId,
  initialTab = 'overview',
  compact = false
}) => {
  const { pushToast, openShadowing, settings } = useAppStore();
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [userVocab, setUserVocab] = useState<UserVocabItem | null>(null);
  const [usage, setUsage] = useState<UsageDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'usage' | 'etymology' | 'practice'>(
    initialTab
  );
  const [selectedCharIdx, setSelectedCharIdx] = useState(0);
  const [graphic, setGraphic] = useState<HanziGraphic | null>(null);
  const [aiUsageLoading, setAiUsageLoading] = useState(false);
  const [aiMnemonicLoading, setAiMnemonicLoading] = useState(false);
  const [mnemonicExtra, setMnemonicExtra] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, wordId]);

  useEffect(() => {
    let cancelled = false;
    setSelectedCharIdx(0);
    setMnemonicExtra(null);

    (async () => {
      const found = await db.dictionary.get(wordId);
      if (cancelled) return;
      if (!found) {
        setEntry(null);
        return;
      }
      setEntry(found);
      setUsage(parseUsageDetails(found));
      const uv = await db.userVocab.where('wordId').equals(found.id).first();
      if (!cancelled) setUserVocab(uv || null);
    })();

    return () => {
      cancelled = true;
    };
  }, [wordId]);

  const chars = useMemo(
    () => (entry ? Array.from(entry.simplified).filter(isHanziChar) : []),
    [entry]
  );
  const activeChar = chars[selectedCharIdx] || chars[0] || '';

  useEffect(() => {
    if (!activeChar) {
      setGraphic(null);
      return;
    }
    let cancelled = false;
    db.hanziGraphics.get(activeChar).then((g) => {
      if (!cancelled) setGraphic(g || null);
    });
    return () => {
      cancelled = true;
    };
  }, [activeChar]);

  const matchingConfusableGroup = useMemo(() => {
    if (!entry) return null;
    return (
      CONFUSABLE_GROUPS.find((g) =>
        g.items.some((it) => it.hanzi === entry.simplified || it.hanzi === activeChar)
      ) || null
    );
  }, [entry, activeChar]);

  const handleToggleVocab = async () => {
    if (!entry) return;
    const res = await toggleUserVocab(entry.id, entry.simplified, 'lookup');
    const uv = await db.userVocab.where('wordId').equals(entry.id).first();
    setUserVocab(uv || null);
    pushToast(
      res === 'added'
        ? `Đã thêm "${entry.simplified}" vào sổ ôn FSRS`
        : `Đã xóa "${entry.simplified}" khỏi sổ ôn`,
      res === 'added' ? 'success' : 'info'
    );
  };

  const handleMarkMastered = async () => {
    if (!entry) return;
    const nextStatus = userVocab?.status === 'mastered' ? 'learning' : 'mastered';
    const updated = await setVocabStatus(entry.id, entry.simplified, nextStatus, 'lookup');
    setUserVocab(updated);
    pushToast(
      nextStatus === 'mastered'
        ? `Đã đánh dấu "${entry.simplified}" là Đã thuộc!`
        : `Đã chuyển "${entry.simplified}" về Đang học.`,
      'success'
    );
  };

  const handleAiAnalyzeUsage = async () => {
    if (!entry) return;
    setAiUsageLoading(true);
    try {
      const enriched = await analyzeWordUsageAI(entry);
      setUsage(enriched);
      pushToast('Đã phân tích toàn bộ cách dùng & lưu vĩnh viễn vào máy!', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi gọi AI phân tích từ', 'error');
    } finally {
      setAiUsageLoading(false);
    }
  };

  const handleAiMnemonic = async () => {
    if (!activeChar) return;
    setAiMnemonicLoading(true);
    try {
      const res = await generateMnemonicAI(activeChar, graphic);
      setMnemonicExtra(res.mnemonicStoryVi);
      if (graphic) setGraphic({ ...graphic, mnemonicVi: res.mnemonicStoryVi });
      pushToast('Đã tạo câu chuyện chiết tự & lưu offline!', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi tạo chiết tự AI', 'error');
    } finally {
      setAiMnemonicLoading(false);
    }
  };

  if (!entry) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
        Chọn một từ ở danh sách để xem hướng dẫn nét viết, toàn bộ cách dùng và luyện viết.
      </div>
    );
  }

  const radicalInfo = RADICAL_BY_CHAR.get(graphic?.radical || entry.radical);
  const decompStr = graphic?.decomposition || '';
  const decompLayout = decompStr ? IDS_EXPLANATIONS[decompStr[0]] : undefined;
  const decompParts = Array.from(decompStr).filter(
    (c) => !IDS_EXPLANATIONS[c] && c !== '？' && c !== '?'
  );

  return (
    <div className="space-y-4">
      <DisplayControlBar compact={compact} />

      {/* Header Từ vựng */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-hanzi text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white tracking-wider">
                {entry.simplified}
              </h1>
              <button
                type="button"
                onClick={() => speakChinese(entry.simplified).catch(() => {})}
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-300 hover:bg-brand-100 transition active:scale-95"
                title="Nghe phát âm chuẩn"
              >
                <Volume2 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  openShadowing({
                    hanzi: entry.simplified,
                    pinyin: entry.pinyin,
                    translationVi: entry.meanings.join('; ')
                  })
                }
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/40 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
                title="Luyện đọc nhại phát âm từ này"
              >
                <Mic className="w-3.5 h-3.5 text-brand-500" />
                <span>Shadowing</span>
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PeekableText
                kind="pinyin"
                inline
                className="text-lg font-semibold text-brand-600 dark:text-brand-400"
              >
                {entry.pinyin}
              </PeekableText>
              {entry.hanViet && (
                <PeekableText
                  kind="hanviet"
                  inline
                  className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/60"
                >
                  Hán-Việt: {entry.hanViet}
                </PeekableText>
              )}
              {entry.hskLevel > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  HSK {entry.hskLevel}
                </span>
              )}
              {settings.hskStandard === 'hsk3' && entry.hsk3Level && entry.hsk3Level > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  HSK 3.0 · Cấp {entry.hsk3Level}
                </span>
              )}
              {userVocab?.isLeech && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  <AlertTriangle className="w-3 h-3" />
                  Tử huyệt
                </span>
              )}
            </div>

            <PeekableText
              kind="meaning"
              className="mt-2 text-base font-medium text-slate-700 dark:text-slate-200"
            >
              {entry.meanings.join(' • ')}
            </PeekableText>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleToggleVocab}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                userVocab
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm'
              }`}
            >
              {userVocab ? (
                <>
                  <BookmarkCheck className="w-4 h-4" />
                  <span>Đã lưu sổ ôn</span>
                </>
              ) : (
                <>
                  <BookmarkPlus className="w-4 h-4" />
                  <span>+ Sổ học FSRS</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleMarkMastered}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                userVocab?.status === 'mastered'
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{userVocab?.status === 'mastered' ? 'Đã thuộc' : 'Đánh dấu đã thuộc'}</span>
            </button>
          </div>
        </div>

        {/* 4 Tabs chuyên sâu */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {[
            { id: 'overview', label: '1. Tổng quan & Nét', icon: BookOpen },
            { id: 'usage', label: '2. Cách dùng chi tiết', icon: Sparkles },
            { id: 'etymology', label: '3. Chiết tự & Bộ thủ', icon: Layers },
            { id: 'practice', label: '4. Luyện viết ngay', icon: PenTool }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                  active
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chọn từng chữ đơn nếu là từ ghép (dùng cho Tab 1, 3, 4) */}
      {chars.length > 1 && activeTab !== 'usage' && (
        <div className="flex items-center gap-2 flex-wrap px-1">
          <span className="text-xs font-semibold text-slate-500">Chọn chữ để xem/viết:</span>
          {chars.map((ch, idx) => (
            <button
              key={`${ch}-${idx}`}
              type="button"
              onClick={() => setSelectedCharIdx(idx)}
              className={`w-10 h-10 rounded-xl font-hanzi text-xl font-bold border transition ${
                selectedCharIdx === idx
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-brand-400'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      )}

      {/* TAB 1: Tổng quan & Hoạt ảnh thứ tự nét */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col items-center">
            <h3 className="text-sm font-bold mb-3 self-start">
              Thứ tự nét viết chữ "{activeChar}"
            </h3>
            {activeChar && (
              <HanziStrokePlayer char={activeChar} mode="animate" size={compact ? 190 : 220} />
            )}
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h3 className="text-sm font-bold">Thông tin cấu trúc</h3>
            <div className="grid grid-cols-2 gap-2.5 text-sm">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3">
                <div className="text-xs text-slate-400">Bộ thủ</div>
                <div className="mt-0.5 font-hanzi text-xl font-bold text-brand-600 dark:text-brand-400">
                  {graphic?.radical || entry.radical || '—'}
                </div>
                {radicalInfo && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {radicalInfo.hanViet} ({radicalInfo.meaningVi})
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3">
                <div className="text-xs text-slate-400">Số nét chữ "{activeChar}"</div>
                <div className="mt-0.5 text-xl font-bold">
                  {graphic?.strokesCount || entry.strokesCount} nét
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Tần suất phổ thông #{entry.frequency}
                </div>
              </div>
            </div>

            {usage?.senses?.[0]?.examples?.[0] && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/50 dark:bg-slate-950/40">
                <div className="text-xs font-semibold text-slate-400 mb-1.5">Ví dụ tiêu biểu</div>
                <InteractiveHanziText
                  text={usage.senses[0].examples[0].hanzi}
                  highlightWords={[entry.simplified]}
                  sentencePinyin={usage.senses[0].examples[0].pinyin}
                  sentenceTranslationVi={usage.senses[0].examples[0].translationVi}
                  allowShadowing
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Cách dùng & Toàn bộ Trường hợp Sử dụng (TRỌNG TÂM) */}
      {activeTab === 'usage' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-brand-50 to-amber-50 dark:from-brand-950/40 dark:to-amber-950/30 border border-brand-200/70 dark:border-brand-800/50 p-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Toàn bộ trường hợp sử dụng & ví dụ 4 tầng
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {usage?.aiEnriched
                  ? 'Đã được AI phân tích chuyên sâu & lưu vĩnh viễn trong máy để xem offline.'
                  : 'Bấm nút bên cạnh để AI phân tích đầy đủ mọi nét nghĩa, sắc thái, cụm từ & lưu offline mãi mãi.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAiAnalyzeUsage}
              disabled={aiUsageLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 text-xs font-semibold shadow-sm disabled:opacity-50 transition"
            >
              {aiUsageLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>
                {usage?.aiEnriched
                  ? 'Cập nhật lại phân tích AI'
                  : 'AI phân tích toàn bộ cách dùng & thêm ví dụ'}
              </span>
            </button>
          </div>

          {(usage?.senses || []).map((sense, sIdx) => (
            <div
              key={sIdx}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold">
                  {sIdx + 1}
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  {sense.partOfSpeech}
                </span>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                  Sắc thái: {sense.register}
                </span>
              </div>

              <PeekableText
                kind="meaning"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                {sense.meaningVi}
              </PeekableText>

              {sense.grammarPattern && (
                <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 px-3.5 py-2 text-xs">
                  <span className="font-bold text-amber-800 dark:text-amber-300">
                    Cấu trúc ngữ pháp:{' '}
                  </span>
                  <span className="font-hanzi text-sm text-slate-900 dark:text-slate-100">
                    {sense.grammarPattern}
                  </span>
                </div>
              )}

              {sense.collocations.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500 mr-1">Cụm từ cố định:</span>
                  {sense.collocations.map((col, cIdx) => (
                    <span
                      key={cIdx}
                      className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-hanzi font-medium"
                    >
                      <InteractiveHanziText text={col} hanziClassName="text-sm" />
                    </span>
                  ))}
                </div>
              )}

              {/* Ví dụ 4 tầng cho từng trường hợp dùng */}
              <div className="space-y-2.5 pt-1">
                {sense.examples.map((ex, exIdx) => (
                  <div
                    key={exIdx}
                    className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <InteractiveHanziText
                        text={ex.hanzi}
                        highlightWords={[entry.simplified]}
                        hanziClassName="text-lg font-medium"
                        sentencePinyin={ex.pinyin}
                        allowShadowing
                      />
                      <button
                        type="button"
                        onClick={() => speakChinese(ex.hanzi).catch(() => {})}
                        className="shrink-0 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-brand-600 hover:bg-brand-50 transition"
                        title="Nghe câu ví dụ"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                    <PeekableText
                      kind="meaning"
                      className="text-xs text-slate-500 dark:text-slate-400 italic"
                    >
                      Sát nghĩa: {ex.literalVi}
                    </PeekableText>
                    <PeekableText
                      kind="meaning"
                      className="text-sm font-medium text-slate-800 dark:text-slate-200"
                    >
                      → {ex.translationVi}
                    </PeekableText>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Phân biệt từ đồng nghĩa / hình cận tự */}
          {((usage?.confusableComparisons && usage.confusableComparisons.length > 0) ||
            matchingConfusableGroup) && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Phân biệt với chữ hình cận tự / đồng âm dễ nhầm</span>
              </h4>

              {usage?.confusableComparisons?.map((cmp, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/60 p-3 space-y-1 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-hanzi text-lg font-bold">{cmp.word}</span>
                    <span className="text-xs font-semibold text-brand-600">{cmp.pinyin}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{cmp.differenceVi}</p>
                  <p className="text-xs font-hanzi text-slate-600 dark:text-slate-400">
                    Đối chiếu: {cmp.exampleContrast}
                  </p>
                </div>
              ))}

              {!usage?.confusableComparisons?.length && matchingConfusableGroup && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {matchingConfusableGroup.items.map((it) => (
                    <div
                      key={it.hanzi}
                      className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3 space-y-1 border border-slate-200/70 dark:border-slate-700"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-hanzi text-2xl font-bold text-brand-600">
                          {it.hanzi}
                        </span>
                        <span className="text-xs font-semibold">{it.pinyin}</span>
                        <span className="text-xs text-slate-500">— {it.meaningVi}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{it.tipVi}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Chiết tự & Bộ thủ (Mnemonics) */}
      {activeTab === 'etymology' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-base font-bold">
                Chiết tự & Bộ thủ chữ "<span className="font-hanzi">{activeChar}</span>"
              </h3>
              <p className="text-xs text-slate-500">
                {decompLayout || 'Chữ độc thể / cấu trúc cơ bản'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleAiMnemonic}
              disabled={aiMnemonicLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {aiMnemonicLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>AI tạo câu chuyện ghi nhớ</span>
            </button>
          </div>

          {/* Cây phân tách thành phần */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 flex flex-wrap items-center justify-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-brand-600 text-white font-hanzi text-3xl font-bold shadow-sm">
              {activeChar}
            </div>
            <span className="text-slate-400 font-bold">=</span>
            {decompParts.length > 0 ? (
              decompParts.map((part, idx) => {
                const rad = RADICAL_BY_CHAR.get(part);
                return (
                  <React.Fragment key={`${part}-${idx}`}>
                    {idx > 0 && <span className="text-slate-400 font-bold">+</span>}
                    <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
                      <div className="font-hanzi text-2xl font-bold">{part}</div>
                      <div className="text-[11px] text-slate-500">
                        {rad ? `${rad.hanViet} (${rad.meaningVi})` : 'Thành phần'}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            ) : (
              <span className="text-sm text-slate-500">Chữ độc thể (chính nó là một bộ căn bản)</span>
            )}
          </div>

          {graphic?.etymology && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 text-sm space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Nguồn gốc tạo chữ (MakeMeAHanzi)
              </div>
              {graphic.etymology.type && (
                <div>
                  Phân loại:{' '}
                  <strong>
                    {graphic.etymology.type === 'pictophonetic'
                      ? 'Hình thanh (1 phần gợi nghĩa + 1 phần gợi âm)'
                      : graphic.etymology.type === 'ideographic'
                        ? 'Hội ý (ghép ý các bộ phận)'
                        : 'Tượng hình (mô phỏng hình dáng thực tế)'}
                  </strong>
                </div>
              )}
              {graphic.etymology.semantic && (
                <div>
                  Phần biểu nghĩa:{' '}
                  <span className="font-hanzi text-lg font-bold text-brand-600">
                    {graphic.etymology.semantic}
                  </span>
                </div>
              )}
              {graphic.etymology.phonetic && (
                <div>
                  Phần biểu âm:{' '}
                  <span className="font-hanzi text-lg font-bold text-indigo-600">
                    {graphic.etymology.phonetic}
                  </span>
                </div>
              )}
              {graphic.etymology.hint && (
                <div className="text-slate-600 dark:text-slate-300">
                  Gợi ý gốc: {graphic.etymology.hint}
                </div>
              )}
            </div>
          )}

          {/* Câu chuyện ghi nhớ tiếng Việt */}
          {(mnemonicExtra || graphic?.mnemonicVi || usage?.mnemonicStoryVi) && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-4">
              <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                Câu chuyện ghi nhớ mặt chữ
              </div>
              <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                {mnemonicExtra || graphic?.mnemonicVi || usage?.mnemonicStoryVi}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Luyện viết ngay (Tô nét & Viết mù) */}
      {activeTab === 'practice' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col items-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 text-center">
            Tập viết đúng thứ tự và chiều nét chữ{' '}
            <strong className="font-hanzi text-base text-slate-900 dark:text-white">
              {activeChar}
            </strong>
            . Hệ thống báo đỏ ngay khi sai nét và tự gợi ý sau 2 lần sai liên tiếp.
          </p>
          {activeChar && (
            <HanziStrokePlayer
              char={activeChar}
              mode="quiz"
              size={compact ? 220 : 260}
              onQuizComplete={async ({ totalMistakes }) => {
                await recordStudyActivity({
                  expEarned: totalMistakes === 0 ? 15 : 8
                });
                pushToast(
                  totalMistakes === 0
                    ? `Hoàn hảo! +15 EXP cho chữ "${activeChar}"`
                    : `Hoàn thành chữ "${activeChar}" (+8 EXP)`,
                  'success'
                );
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};
