import React, { useMemo, useState } from 'react';
import { CheckCircle2, Keyboard, ListChecks, PenTool, Volume2, XCircle } from 'lucide-react';
import type { DictionaryEntry } from '@/types';
import { speakChinese } from '@/services/tts/ttsService';
import { Rating, recordStudyActivity, recordVocabReview } from '@/services/fsrs/fsrsService';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { PeekableText } from '@/components/common/PeekableText';
import { HandwritingPad } from '@/features/writing/HandwritingPad';
import { shuffleArray, type ArcadeSentence } from './arcadeUtils';

interface ContextClozeGameProps {
  words: DictionaryEntry[];
  sentences: ArcadeSentence[];
  onFinish: (stats: { correct: number; total: number; exp: number }) => void;
}

/**
 * Game 2: Cloze Deletion — Lấp đầy Bài khóa
 * Hỗ trợ đủ 3 cách trả lời: Trắc nghiệm | Gõ chữ | Vẽ tay trực tiếp vào ô trống!
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

  const [idx, setIdx] = useState(0);
  const [inputMode, setInputMode] = useState<'choice' | 'type' | 'draw'>('choice');
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalExp, setTotalExp] = useState(0);

  const current = items[idx];

  const options = useMemo(() => {
    if (!current) return [];
    const target = current.targetWord;
    const pool = shuffleArray(words.filter((w) => w.id !== target.id)).slice(0, 3);
    return shuffleArray([target, ...pool]);
  }, [current, words]);

  const submitAnswer = async (answerText: string) => {
    if (!current || result) return;
    const isCorrect = answerText.trim() === current.targetWord.simplified;
    setResult(isCorrect ? 'correct' : 'wrong');

    const res = await recordVocabReview(
      current.targetWord.id,
      current.targetWord.simplified,
      isCorrect ? (inputMode === 'draw' ? Rating.Easy : Rating.Good) : Rating.Again,
      { hardcore: hardcoreMode, baseExp: inputMode === 'draw' ? 14 : 10 }
    );
    const nextCorrect = isCorrect ? correctCount + 1 : correctCount;
    const nextExp = totalExp + res.expEarned;
    setCorrectCount(nextCorrect);
    setTotalExp(nextExp);

    speakChinese(current.hanzi).catch(() => {});

    window.setTimeout(async () => {
      if (idx + 1 >= items.length) {
        await recordStudyActivity({ gamesPlayed: 1 });
        onFinish({ correct: nextCorrect, total: items.length, exp: nextExp });
      } else {
        setIdx((i) => i + 1);
        setTyped('');
        setResult(null);
      }
    }, 1300);
  };

  if (!current) return null;

  const parts = current.hanzi.split(current.targetWord.simplified);

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

        {/* Phản hồi đúng/sai */}
        {result && (
          <div
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 ${
              result === 'correct'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
            }`}
          >
            {result === 'correct' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span>
              {result === 'correct'
                ? `Chính xác! "${current.targetWord.simplified}" (${current.targetWord.pinyin})`
                : `Đáp án đúng là: ${current.targetWord.simplified} (${current.targetWord.pinyin}) — ${current.targetWord.meanings[0]}`}
            </span>
          </div>
        )}

        {/* 3 chế độ nhập đáp án */}
        {inputMode === 'choice' && (
          <div className="grid grid-cols-2 gap-2.5">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={Boolean(result)}
                onClick={() => submitAnswer(opt.simplified)}
                className="rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-brand-500 p-3.5 text-center transition active:scale-95"
              >
                <div className="font-hanzi text-2xl font-bold">{opt.simplified}</div>
                <PeekableText
                  kind="pinyin"
                  forceHide={hardcoreMode}
                  className="text-xs text-slate-500 mt-0.5"
                >
                  {opt.pinyin}
                </PeekableText>
              </button>
            ))}
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
                {typed && (
                  <button
                    type="button"
                    onClick={() => setTyped((s) => s.slice(0, -1))}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs font-semibold"
                  >
                    Xóa 1 chữ
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
              onSelectChar={(ch) => setTyped((prev) => `${prev}${ch}`)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
