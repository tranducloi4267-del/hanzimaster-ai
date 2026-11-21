import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Keyboard,
  Lightbulb,
  ListChecks,
  PenTool,
  RotateCcw,
  Volume2,
  XCircle
} from 'lucide-react';
import type { DictionaryEntry } from '@/types';
import { parseUsageDetails } from '@/services/dictionary/dictionaryService';
import { speakChinese } from '@/services/tts/ttsService';
import { Rating, recordStudyActivity, recordVocabReview } from '@/services/fsrs/fsrsService';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { PeekableText } from '@/components/common/PeekableText';
import { HandwritingPad } from '@/features/writing/HandwritingPad';
import { shuffleArray, type ArcadeSentence } from './arcadeUtils';
import { GameNavFooter } from './GameNavFooter';

interface ContextClozeGameProps {
  words: DictionaryEntry[];
  sentences: ArcadeSentence[];
  onFinish: (stats: { correct: number; total: number; exp: number }) => void;
}

interface ClozeHistoryEntry {
  answerText: string;
  result: 'correct' | 'wrong';
}

/**
 * Game 2: Cloze Deletion — Lấp đầy Bài khóa
 * Nâng cấp: Giải thích ngữ cảnh chi tiết, hoàn tác gõ/vẽ, làm lại câu sai, lùi câu trước & tiếp theo.
 */
export const ContextClozeGame: React.FC<ContextClozeGameProps> = ({
  words,
  sentences,
  onFinish
}) => {
  const hardcoreMode = useDisplayStore((s) => s.hardcoreMode);
  const items = useMemo(() => {
    if (sentences.length >= 4) return shuffleArray(sentences).slice(0, 8);
    return shuffleArray(words)
      .slice(0, 8)
      .map((w) => ({
        hanzi: `我每天都在复习“${w.simplified}”这个词。`,
        pinyin: `Wǒ měitiān dōu zài fùxí "${w.pinyin}" zhège cí.`,
        translationVi: `Mỗi ngày tôi đều ôn lại từ "${w.meanings[0]}".`,
        targetWord: w
      }));
  }, [sentences, words]);

  const optionsByIdx = useMemo(
    () =>
      items.map((it) => {
        const pool = shuffleArray(words.filter((w) => w.id !== it.targetWord.id)).slice(0, 3);
        return shuffleArray([it.targetWord, ...pool]);
      }),
    [items, words]
  );

  const [idx, setIdx] = useState(0);
  const [inputMode, setInputMode] = useState<'choice' | 'type' | 'draw'>('choice');
  const [typed, setTyped] = useState('');
  const [history, setHistory] = useState<Record<number, ClozeHistoryEntry>>({});
  const [totalExp, setTotalExp] = useState(0);

  const current = items[idx];
  const record = history[idx] || null;
  const result = record?.result || null;
  const options = optionsByIdx[idx] || [];

  useEffect(() => {
    setTyped(history[idx]?.answerText || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const submitAnswer = async (answerText: string) => {
    if (!current || result) return;
    const cleaned = answerText.trim();
    const isCorrect = cleaned === current.targetWord.simplified;
    setHistory((prev) => ({
      ...prev,
      [idx]: { answerText: cleaned, result: isCorrect ? 'correct' : 'wrong' }
    }));

    const res = await recordVocabReview(
      current.targetWord.id,
      current.targetWord.simplified,
      isCorrect ? (inputMode === 'draw' ? Rating.Easy : Rating.Good) : Rating.Again,
      { hardcore: hardcoreMode, baseExp: inputMode === 'draw' ? 14 : 10 }
    );
    setTotalExp((e) => e + res.expEarned);
    speakChinese(current.hanzi, { silentError: true }).catch(() => {});
  };

  const handleRetry = () => {
    setHistory((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    setTyped('');
  };

  const handleNext = async () => {
    if (idx + 1 >= items.length) {
      const correctCount = Object.values(history).filter((h) => h.result === 'correct').length;
      await recordStudyActivity({ gamesPlayed: 1 });
      onFinish({ correct: correctCount, total: items.length, exp: totalExp });
    } else {
      setIdx((i) => i + 1);
    }
  };

  if (!current) return null;

  const parts = current.hanzi.split(current.targetWord.simplified);
  const usage = parseUsageDetails(current.targetWord);
  const chosenWrongWord =
    record && record.result === 'wrong'
      ? words.find((w) => w.simplified === record.answerText)
      : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          {[
            { id: 'choice', label: 'Trắc nghiệm', icon: ListChecks },
            { id: 'type', label: 'Gõ chữ', icon: Keyboard },
            { id: 'draw', label: 'Vẽ tay vào ô trống', icon: PenTool }
          ].map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setInputMode(m.id as typeof inputMode)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  inputMode === m.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
        <span className="text-xs font-bold text-slate-500">
          Câu {idx + 1}/{items.length}
        </span>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        {/* Câu bài khóa có ô trống */}
        <div className="text-center space-y-2 py-2">
          <div className="font-hanzi text-2xl sm:text-3xl font-bold leading-relaxed">
            {parts[0]}
            <span
              className={`inline-block min-w-[72px] mx-1 px-2.5 py-0.5 rounded-xl border-2 border-dashed align-baseline ${
                result === 'correct'
                  ? 'bg-emerald-100 border-emerald-500 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  : result === 'wrong'
                    ? 'bg-rose-100 border-rose-500 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                    : 'bg-brand-50/70 dark:bg-brand-950/40 border-brand-400 text-brand-600'
              }`}
            >
              {result ? current.targetWord.simplified : typed || '？'}
            </span>
            {parts.slice(1).join(current.targetWord.simplified)}
          </div>

          <PeekableText
            kind="meaning"
            forceHide={hardcoreMode}
            className="text-sm text-slate-600 dark:text-slate-300"
          >
            {current.translationVi}
          </PeekableText>

          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => speakChinese(current.hanzi).catch(() => {})}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 px-3 py-1 text-xs font-semibold"
            >
              <Volume2 className="w-3.5 h-3.5 text-brand-600" />
              Nghe cả câu
            </button>
          </div>
        </div>

        {/* 3 chế độ nhập đáp án */}
        {inputMode === 'choice' && (
          <div className="grid grid-cols-2 gap-2.5">
            {options.map((opt) => {
              const isRight = opt.id === current.targetWord.id;
              const isPicked = record?.answerText === opt.simplified;
              const cls = result
                ? isRight
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                  : isPicked
                    ? 'bg-rose-50 border-rose-500 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200'
                    : 'opacity-45 border-slate-200 dark:border-slate-800'
                : 'border-slate-200 dark:border-slate-700 hover:border-brand-500';

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={Boolean(result)}
                  onClick={() => submitAnswer(opt.simplified)}
                  className={`rounded-xl border-2 p-3.5 text-center transition active:scale-95 ${cls}`}
                >
                  <div className="font-hanzi text-2xl font-bold">{opt.simplified}</div>
                  <PeekableText
                    kind="pinyin"
                    forceHide={hardcoreMode}
                    className="text-xs text-slate-500 mt-0.5"
                  >
                    {opt.pinyin}
                  </PeekableText>
                  {result && <div className="text-[11px] opacity-80 mt-0.5">{opt.meanings[0]}</div>}
                </button>
              );
            })}
          </div>
        )}

        {inputMode === 'type' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) submitAnswer(typed);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={Boolean(result)}
              placeholder={`Gõ từ còn thiếu (${current.targetWord.simplified.length} chữ)...`}
              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 font-hanzi text-lg"
            />
            {typed && !result && (
              <button
                type="button"
                onClick={() => setTyped('')}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold"
                title="Xóa gõ lại"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={!typed.trim() || Boolean(result)}
              className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 text-sm font-bold disabled:opacity-40"
            >
              Xác nhận
            </button>
          </form>
        )}

        {inputMode === 'draw' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 px-3.5 py-2 border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500">
                Ô trống cần <strong>{current.targetWord.simplified.length} chữ</strong> · Đã ghép:{' '}
                <span className="font-hanzi text-lg font-bold text-brand-600 ml-1">
                  {typed || '—'}
                </span>
              </div>
              <div className="flex gap-1.5">
                {typed && !result && (
                  <button
                    type="button"
                    onClick={() => setTyped((s) => s.slice(0, -1))}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs font-semibold"
                  >
                    Lùi 1 chữ
                  </button>
                )}
                <button
                  type="button"
                  disabled={!typed.trim() || Boolean(result)}
                  onClick={() => submitAnswer(typed)}
                  className="rounded-lg bg-brand-600 text-white px-3 py-1 text-xs font-bold disabled:opacity-40"
                >
                  Nộp chữ vẽ
                </button>
              </div>
            </div>
            <HandwritingPad
              compact
              height={200}
              onSelectChar={(ch) => !result && setTyped((prev) => `${prev}${ch}`)}
            />
          </div>
        )}

        {/* Hộp Giải thích chi tiết sau khi trả lời */}
        {record && (
          <div
            className={`rounded-2xl p-4 text-xs space-y-2 border ${
              record.result === 'correct'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-100'
                : 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-100'
            }`}
          >
            <div className="font-bold text-sm flex items-center gap-1.5">
              {record.result === 'correct' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>
                {record.result === 'correct'
                  ? `Chính xác! "${current.targetWord.simplified}" (${current.targetWord.pinyin})`
                  : `Bạn chọn "${record.answerText}" chưa khớp — Đáp án đúng: ${current.targetWord.simplified} (${current.targetWord.pinyin})`}
              </span>
            </div>

            <div className="flex items-start gap-1.5 leading-relaxed">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div>
                  <strong>Giải thích ngữ cảnh:</strong> Trong câu{' '}
                  <span className="font-hanzi text-sm font-bold">{current.hanzi}</span> (
                  {current.pinyin} — <em>"{current.translationVi}"</em>), chỗ trống cần từ{' '}
                  <strong className="font-hanzi text-sm">{current.targetWord.simplified}</strong>{' '}
                  ({current.targetWord.pinyin}
                  {current.targetWord.hanViet ? `, Hán-Việt: ${current.targetWord.hanViet}` : ''}) có
                  nghĩa là <strong>"{current.targetWord.meanings.join('; ')}"</strong>.
                  {usage.senses?.[0]?.grammarPattern && (
                    <span> Cấu trúc: {usage.senses[0].grammarPattern}.</span>
                  )}
                </div>
                {chosenWrongWord && (
                  <div className="opacity-90">
                    ⚠️ Từ bạn chọn <strong className="font-hanzi">{chosenWrongWord.simplified}</strong>{' '}
                    ({chosenWrongWord.pinyin}) nghĩa là <em>"{chosenWrongWord.meanings[0]}"</em> nên
                    không phù hợp với nghĩa của câu này.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <GameNavFooter
          currentIndex={idx}
          total={items.length}
          canGoPrev={idx > 0}
          canGoNext={Boolean(result)}
          isLast={idx + 1 >= items.length}
          showRetry={Boolean(result)}
          onPrev={() => setIdx((i) => Math.max(0, i - 1))}
          onRetry={handleRetry}
          onNext={handleNext}
        />
      </div>
    </div>
  );
};
