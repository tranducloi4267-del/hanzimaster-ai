import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Flame, RotateCw, Timer, Volume2, XCircle } from 'lucide-react';
import type { DictionaryEntry } from '@/types';
import { parseUsageDetails } from '@/services/dictionary/dictionaryService';
import { speakChinese } from '@/services/tts/ttsService';
import { Rating, recordStudyActivity, recordVocabReview } from '@/services/fsrs/fsrsService';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { PeekableText } from '@/components/common/PeekableText';
import { shuffleArray } from './arcadeUtils';

interface SpeedRecallGameProps {
  words: DictionaryEntry[];
  onFinish: (stats: { correct: number; total: number; exp: number }) => void;
}

type RecallDirection = 'hanzi-to-meaning' | 'audio-to-hanzi' | 'meaning-to-hanzi' | 'cloze-to-hanzi';

const DIR_LABELS: Record<RecallDirection, string> = {
  'hanzi-to-meaning': 'Nhìn chữ → Chọn nghĩa',
  'audio-to-hanzi': 'Nghe âm → Chọn chữ',
  'meaning-to-hanzi': 'Nhìn nghĩa → Chọn / Gõ chữ',
  'cloze-to-hanzi': 'Câu đục lỗ → Chọn từ'
};

export const SpeedRecallGame: React.FC<SpeedRecallGameProps> = ({ words, onFinish }) => {
  const hardcoreMode = useDisplayStore((s) => s.hardcoreMode);
  const deck = useMemo(() => shuffleArray(words).slice(0, 10), [words]);

  const [mode, setMode] = useState<'speed' | 'flashcard'>('speed');
  const [idx, setIdx] = useState(0);
  const [combo, setCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalExp, setTotalExp] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [answered, setAnswered] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [flipped, setFlipped] = useState(false);

  const current = deck[idx];

  const direction: RecallDirection = useMemo(() => {
    const dirs: RecallDirection[] = [
      'hanzi-to-meaning',
      'audio-to-hanzi',
      'meaning-to-hanzi',
      'cloze-to-hanzi'
    ];
    return dirs[idx % dirs.length];
  }, [idx]);

  const options = useMemo(() => {
    if (!current) return [];
    const distractors = shuffleArray(words.filter((w) => w.id !== current.id)).slice(0, 3);
    return shuffleArray([current, ...distractors]);
  }, [current, words]);

  const clozeSentence = useMemo(() => {
    if (!current) return null;
    const u = parseUsageDetails(current);
    const ex = u.senses?.[0]?.examples?.[0];
    if (ex && ex.hanzi.includes(current.simplified)) {
      return {
        masked: ex.hanzi.replace(current.simplified, ' _____ '),
        vi: ex.translationVi
      };
    }
    return {
      masked: `我今天学会了“ _____ ”这个词。`,
      vi: `Hôm nay tôi đã học từ "${current.meanings[0]}".`
    };
  }, [current]);

  useEffect(() => {
    if (!current) return;
    if (direction === 'audio-to-hanzi' && mode === 'speed') {
      speakChinese(current.simplified).catch(() => {});
    }
  }, [current, direction, mode]);

  // Countdown timer in Speed mode
  useEffect(() => {
    if (mode !== 'speed' || answered || !current) return;
    if (timeLeft <= 0) {
      handleSelectAnswer('__TIMEOUT__');
      return;
    }
    const t = window.setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, mode, answered, current]);

  const advance = async (nextCorrect: number, nextExp: number) => {
    if (idx + 1 >= deck.length) {
      await recordStudyActivity({ gamesPlayed: 1 });
      onFinish({ correct: nextCorrect, total: deck.length, exp: nextExp });
      return;
    }
    setIdx((i) => i + 1);
    setAnswered(null);
    setTypedAnswer('');
    setFlipped(false);
    setTimeLeft(15);
  };

  const handleSelectAnswer = async (pickedId: string) => {
    if (answered || !current) return;
    setAnswered(pickedId);
    const isCorrect =
      pickedId === current.id || pickedId.trim() === current.simplified;

    const grade = isCorrect ? (timeLeft >= 10 ? Rating.Easy : Rating.Good) : Rating.Again;
    const res = await recordVocabReview(current.id, current.simplified, grade, {
      hardcore: hardcoreMode
    });
    const nextCorrect = isCorrect ? correctCount + 1 : correctCount;
    const nextExp = totalExp + res.expEarned;
    setCorrectCount(nextCorrect);
    setTotalExp(nextExp);
    setCombo(isCorrect ? combo + 1 : 0);

    if (isCorrect) speakChinese(current.simplified).catch(() => {});

    window.setTimeout(() => {
      advance(nextCorrect, nextExp);
    }, 1000);
  };

  const handleFlashcardRate = async (grade: typeof Rating.Again | typeof Rating.Hard | typeof Rating.Good | typeof Rating.Easy) => {
    if (!current) return;
    const res = await recordVocabReview(current.id, current.simplified, grade, {
      hardcore: hardcoreMode
    });
    const isOk = grade !== Rating.Again;
    const nextCorrect = isOk ? correctCount + 1 : correctCount;
    const nextExp = totalExp + res.expEarned;
    setCorrectCount(nextCorrect);
    setTotalExp(nextExp);
    setCombo(isOk ? combo + 1 : 0);
    await advance(nextCorrect, nextExp);
  };

  if (!current) return null;

  return (
    <div className="space-y-4">
      {/* Mode switcher + Progress */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('speed');
              setTimeLeft(15);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === 'speed' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Đấu trường Tốc độ
          </button>
          <button
            type="button"
            onClick={() => setMode('flashcard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === 'flashcard' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Lật thẻ 4 chiều FSRS
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="text-slate-500">
            Câu {idx + 1}/{deck.length}
          </span>
          {combo > 1 && (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Flame className="w-4 h-4" />
              Combo x{combo}
            </span>
          )}
          {mode === 'speed' && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                timeLeft <= 5
                  ? 'bg-rose-100 text-rose-700 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
              {timeLeft}s
            </span>
          )}
        </div>
      </div>

      {/* Mode 1: Speed Recall 4 chiều */}
      {mode === 'speed' ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="text-center space-y-2">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-300">
              {DIR_LABELS[direction]}
            </span>

            {direction === 'hanzi-to-meaning' && (
              <div>
                <div className="font-hanzi text-5xl font-bold mt-2">{current.simplified}</div>
                <PeekableText
                  kind="pinyin"
                  forceHide={hardcoreMode}
                  className="mt-2 text-sm text-brand-600 font-semibold"
                >
                  {current.pinyin}
                </PeekableText>
              </div>
            )}

            {direction === 'audio-to-hanzi' && (
              <div className="py-3">
                <button
                  type="button"
                  onClick={() => speakChinese(current.simplified).catch(() => {})}
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white px-6 py-4 text-sm font-bold shadow-md active:scale-95 transition"
                >
                  <Volume2 className="w-6 h-6" />
                  <span>Nghe lại phát âm</span>
                </button>
              </div>
            )}

            {direction === 'meaning-to-hanzi' && (
              <div className="py-2">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {current.meanings.join('; ')}
                </div>
                {current.hanViet && (
                  <PeekableText
                    kind="hanviet"
                    forceHide={hardcoreMode}
                    className="mt-1 text-xs font-semibold uppercase text-amber-600"
                  >
                    Hán-Việt: {current.hanViet}
                  </PeekableText>
                )}
              </div>
            )}

            {direction === 'cloze-to-hanzi' && clozeSentence && (
              <div className="py-2 space-y-1.5">
                <div className="font-hanzi text-2xl font-bold">{clozeSentence.masked}</div>
                <PeekableText
                  kind="meaning"
                  forceHide={hardcoreMode}
                  className="text-sm text-slate-500"
                >
                  {clozeSentence.vi}
                </PeekableText>
              </div>
            )}
          </div>

          {/* 4 đáp án lựa chọn */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {options.map((opt) => {
              const isRight = opt.id === current.id;
              const isPicked = answered === opt.id;
              const cls = answered
                ? isRight
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                  : isPicked
                    ? 'bg-rose-50 border-rose-500 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200'
                    : 'opacity-50 border-slate-200 dark:border-slate-800'
                : 'border-slate-200 dark:border-slate-700 hover:border-brand-500 hover:bg-brand-50/40 dark:hover:bg-brand-950/30';

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={Boolean(answered)}
                  onClick={() => handleSelectAnswer(opt.id)}
                  className={`rounded-xl border-2 p-3.5 text-left transition flex items-center justify-between gap-2 ${cls}`}
                >
                  <div>
                    {direction === 'hanzi-to-meaning' ? (
                      <div className="text-sm font-semibold">{opt.meanings.join('; ')}</div>
                    ) : (
                      <>
                        <div className="font-hanzi text-2xl font-bold">{opt.simplified}</div>
                        <PeekableText
                          kind="pinyin"
                          forceHide={hardcoreMode}
                          className="text-xs text-slate-500"
                        >
                          {opt.pinyin}
                        </PeekableText>
                      </>
                    )}
                  </div>
                  {answered && isRight && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                  {answered && isPicked && !isRight && (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Hỗ trợ gõ trực tiếp ở chiều nhìn nghĩa */}
          {direction === 'meaning-to-hanzi' && !answered && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (typedAnswer.trim()) handleSelectAnswer(typedAnswer.trim());
              }}
              className="flex gap-2 pt-1"
            >
              <input
                type="text"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                placeholder="Hoặc tự gõ chữ Hán vào đây rồi bấm Enter..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-hanzi"
              />
              <button
                type="submit"
                className="rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 text-xs font-bold"
              >
                Kiểm tra
              </button>
            </form>
          )}
        </div>
      ) : (
        /* Mode 2: Lật thẻ 4 chiều FSRS */
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5 text-center">
          <div
            onClick={() => setFlipped((f) => !f)}
            className="cursor-pointer min-h-[210px] flex flex-col items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-6 transition hover:border-brand-400"
          >
            <span className="text-[11px] font-bold uppercase text-brand-500 mb-3">
              {flipped ? 'Mặt sau — Đáp án' : `Mặt trước · ${DIR_LABELS[direction]}`}
            </span>
            {!flipped ? (
              direction === 'meaning-to-hanzi' ? (
                <div className="text-2xl font-bold">{current.meanings.join('; ')}</div>
              ) : direction === 'audio-to-hanzi' ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakChinese(current.simplified).catch(() => {});
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 text-white px-5 py-3 text-sm font-bold"
                >
                  <Volume2 className="w-5 h-5" />
                  Nghe phát âm để nhớ chữ
                </button>
              ) : (
                <div className="font-hanzi text-5xl font-bold">{current.simplified}</div>
              )
            ) : (
              <div className="space-y-2">
                <div className="font-hanzi text-5xl font-bold text-brand-600">
                  {current.simplified}
                </div>
                <div className="text-lg font-semibold">{current.pinyin}</div>
                {current.hanViet && (
                  <div className="text-xs font-bold uppercase text-amber-600">
                    Hán-Việt: {current.hanViet}
                  </div>
                )}
                <div className="text-base text-slate-700 dark:text-slate-200">
                  {current.meanings.join(' • ')}
                </div>
              </div>
            )}
            <span className="mt-4 inline-flex items-center gap-1 text-xs text-slate-400">
              <RotateCw className="w-3.5 h-3.5" /> Chạm thẻ để lật
            </span>
          </div>

          {flipped && (
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { grade: Rating.Again, label: 'Quên', cls: 'bg-rose-600 hover:bg-rose-700' },
                  { grade: Rating.Hard, label: 'Khó', cls: 'bg-amber-600 hover:bg-amber-700' },
                  { grade: Rating.Good, label: 'Nhớ', cls: 'bg-emerald-600 hover:bg-emerald-700' },
                  { grade: Rating.Easy, label: 'Rất dễ', cls: 'bg-sky-600 hover:bg-sky-700' }
                ] as const
              ).map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => handleFlashcardRate(btn.grade)}
                  className={`rounded-xl py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95 ${btn.cls}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
