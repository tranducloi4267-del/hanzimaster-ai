import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Flame,
  Lightbulb,
  RotateCw,
  Timer,
  Volume2,
  XCircle
} from 'lucide-react';
import type { DictionaryEntry } from '@/types';
import { parseUsageDetails } from '@/services/dictionary/dictionaryService';
import { speakChinese } from '@/services/tts/ttsService';
import { Rating, recordStudyActivity, recordVocabReview } from '@/services/fsrs/fsrsService';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { PeekableText } from '@/components/common/PeekableText';
import { shuffleArray } from './arcadeUtils';
import { GameNavFooter } from './GameNavFooter';

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

interface SpeedHistoryEntry {
  pickedId: string;
  isCorrect: boolean;
}

export const SpeedRecallGame: React.FC<SpeedRecallGameProps> = ({ words, onFinish }) => {
  const hardcoreMode = useDisplayStore((s) => s.hardcoreMode);
  const deck = useMemo(() => shuffleArray(words).slice(0, 10), [words]);

  // Cố định danh sách 4 lựa chọn cho từng câu hỏi để khi bấm "Câu trước" không bị xáo lại
  const optionsByIdx = useMemo(
    () =>
      deck.map((item) => {
        const distractors = shuffleArray(words.filter((w) => w.id !== item.id)).slice(0, 3);
        return shuffleArray([item, ...distractors]);
      }),
    [deck, words]
  );

  const [mode, setMode] = useState<'speed' | 'flashcard'>('speed');
  const [timerEnabled, setTimerEnabled] = useState(false); // Mặc định TẮT hẹn giờ để không bị giục khi học kỹ!
  const [idx, setIdx] = useState(0);
  const [combo, setCombo] = useState(0);
  const [totalExp, setTotalExp] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [history, setHistory] = useState<Record<number, SpeedHistoryEntry>>({});
  const [flashRated, setFlashRated] = useState<Record<number, boolean>>({});
  const [typedAnswer, setTypedAnswer] = useState('');
  const [flipped, setFlipped] = useState(false);

  const current = deck[idx];
  const currentRecord = history[idx] || null;
  const answered = currentRecord?.pickedId || null;
  const options = optionsByIdx[idx] || [];

  const direction: RecallDirection = useMemo(() => {
    const dirs: RecallDirection[] = [
      'hanzi-to-meaning',
      'audio-to-hanzi',
      'meaning-to-hanzi',
      'cloze-to-hanzi'
    ];
    return dirs[idx % dirs.length];
  }, [idx]);

  const usageDetails = useMemo(() => (current ? parseUsageDetails(current) : null), [current]);
  const sampleEx = usageDetails?.senses?.[0]?.examples?.[0] || null;

  const clozeSentence = useMemo(() => {
    if (!current) return null;
    if (sampleEx && sampleEx.hanzi.includes(current.simplified)) {
      return {
        full: sampleEx.hanzi,
        pinyin: sampleEx.pinyin,
        masked: sampleEx.hanzi.replace(current.simplified, ' _____ '),
        vi: sampleEx.translationVi
      };
    }
    return {
      full: `我今天学会了“${current.simplified}”这个词。`,
      pinyin: `Wǒ jīntiān xuéhuìle "${current.pinyin}" zhège cí.`,
      masked: `我今天学会了“ _____ ”这个词。`,
      vi: `Hôm nay tôi đã học từ "${current.meanings[0]}".`
    };
  }, [current, sampleEx]);

  useEffect(() => {
    setTimeLeft(15);
    setTypedAnswer('');
    setFlipped(false);
    if (current && direction === 'audio-to-hanzi' && mode === 'speed' && !history[idx]) {
      speakChinese(current.simplified, { silentError: true }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, mode]);

  // Đồng hồ đếm ngược tùy chọn (chỉ chạy khi bật hẹn giờ)
  useEffect(() => {
    if (mode !== 'speed' || !timerEnabled || answered || !current) return;
    if (timeLeft <= 0) {
      handleSelectAnswer('__TIMEOUT__');
      return;
    }
    const t = window.setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, mode, timerEnabled, answered, current]);

  const handleSelectAnswer = async (pickedId: string) => {
    if (answered || !current) return;
    const isCorrect = pickedId === current.id || pickedId.trim() === current.simplified;

    setHistory((prev) => ({
      ...prev,
      [idx]: { pickedId, isCorrect }
    }));

    const grade = isCorrect
      ? timerEnabled && timeLeft >= 10
        ? Rating.Easy
        : Rating.Good
      : Rating.Again;
    const res = await recordVocabReview(current.id, current.simplified, grade, {
      hardcore: hardcoreMode
    });
    setTotalExp((e) => e + res.expEarned);
    setCombo(isCorrect ? combo + 1 : 0);

    speakChinese(current.simplified, { silentError: true }).catch(() => {});
  };

  const handleRetryCurrent = () => {
    setHistory((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    setTypedAnswer('');
    setTimeLeft(15);
  };

  const handleNext = async () => {
    if (idx + 1 >= deck.length) {
      const finalCorrect =
        mode === 'speed'
          ? Object.values(history).filter((h) => h.isCorrect).length
          : Object.values(flashRated).filter(Boolean).length;
      await recordStudyActivity({ gamesPlayed: 1 });
      onFinish({ correct: finalCorrect, total: deck.length, exp: totalExp });
      return;
    }
    setIdx((i) => i + 1);
  };

  const handleFlashcardRate = async (
    grade: typeof Rating.Again | typeof Rating.Hard | typeof Rating.Good | typeof Rating.Easy
  ) => {
    if (!current) return;
    const res = await recordVocabReview(current.id, current.simplified, grade, {
      hardcore: hardcoreMode
    });
    const isOk = grade !== Rating.Again;
    setFlashRated((prev) => ({ ...prev, [idx]: isOk }));
    setTotalExp((e) => e + res.expEarned);
    setCombo(isOk ? combo + 1 : 0);
    if (idx + 1 < deck.length) {
      setIdx((i) => i + 1);
    } else {
      const finalCorrect = Object.values({ ...flashRated, [idx]: isOk }).filter(Boolean).length;
      await recordStudyActivity({ gamesPlayed: 1 });
      onFinish({ correct: finalCorrect, total: deck.length, exp: totalExp + res.expEarned });
    }
  };

  if (!current) return null;

  const pickedWord = options.find((o) => o.id === answered);

  return (
    <div className="space-y-4">
      {/* Mode switcher + Timer Toggle + Progress */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('speed');
              setTimeLeft(15);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === 'speed'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Trắc nghiệm 4 chiều
          </button>
          <button
            type="button"
            onClick={() => setMode('flashcard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === 'flashcard'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Lật thẻ FSRS
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="text-slate-500">
            Câu {idx + 1}/{deck.length}
          </span>
          {combo > 1 && (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Flame className="w-4 h-4" />
              x{combo}
            </span>
          )}
          {mode === 'speed' && (
            <button
              type="button"
              onClick={() => {
                setTimerEnabled((v) => !v);
                setTimeLeft(15);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border transition ${
                timerEnabled
                  ? timeLeft <= 5
                    ? 'bg-rose-100 border-rose-300 text-rose-700 animate-pulse'
                    : 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
              title="Bật hoặc tắt đồng hồ đếm ngược 15 giây"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>{timerEnabled ? `${timeLeft}s` : 'Hẹn giờ: Tắt'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode 1: Trắc nghiệm 4 chiều */}
      {mode === 'speed' ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-5">
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
                  <span>Nghe phát âm</span>
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
                <div className="font-hanzi text-2xl font-bold">
                  {answered ? clozeSentence.full : clozeSentence.masked}
                </div>
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
                      <>
                        <div className="text-sm font-semibold">{opt.meanings.join('; ')}</div>
                        {answered && (
                          <div className="text-xs opacity-75 mt-0.5 font-hanzi">
                            {opt.simplified} ({opt.pinyin})
                          </div>
                        )}
                      </>
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
                        {answered && (
                          <div className="text-xs opacity-80 mt-0.5">{opt.meanings[0]}</div>
                        )}
                      </>
                    )}
                  </div>
                  {answered && isRight && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  {answered && isPicked && !isRight && (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Gõ trực tiếp ở chiều nhìn nghĩa */}
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

          {/* Hộp Giải thích chi tiết sau khi trả lời */}
          {currentRecord && (
            <div
              className={`rounded-2xl p-4 text-xs space-y-2 border ${
                currentRecord.isCorrect
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-100'
                  : 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-sm flex items-center gap-1.5">
                  {currentRecord.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600" />
                  )}
                  <span>
                    {currentRecord.isCorrect
                      ? `Chính xác! ${current.simplified} (${current.pinyin})`
                      : answered === '__TIMEOUT__'
                        ? `Hết giờ! Đáp án đúng là ${current.simplified} (${current.pinyin})`
                        : `Chưa chính xác! Đáp án đúng là ${current.simplified} (${current.pinyin})`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => speakChinese(current.simplified).catch(() => {})}
                  className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/70 text-brand-600 shrink-0"
                  title="Nghe lại từ này"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-start gap-1.5 leading-relaxed">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div>
                    <strong>Vì sao chọn đáp án này:</strong>{' '}
                    <span className="font-hanzi text-base font-bold">{current.simplified}</span>{' '}
                    đọc là <strong>{current.pinyin}</strong>
                    {current.hanViet ? ` (Hán-Việt: ${current.hanViet})` : ''}, có nghĩa là{' '}
                    <strong>"{current.meanings.join('; ')}"</strong>.
                    {usageDetails?.senses?.[0]?.grammarPattern && (
                      <span> Cấu trúc thường dùng: {usageDetails.senses[0].grammarPattern}.</span>
                    )}
                  </div>
                  {!currentRecord.isCorrect && pickedWord && (
                    <div className="opacity-90">
                      ⚠️ Từ bạn vừa chọn là{' '}
                      <strong className="font-hanzi">{pickedWord.simplified}</strong> (
                      {pickedWord.pinyin}) có nghĩa là <em>"{pickedWord.meanings[0]}"</em> (khác với yêu cầu câu hỏi).
                    </div>
                  )}
                  {sampleEx && (
                    <div className="pt-1 border-t border-black/10 dark:border-white/10">
                      <strong>Ví dụ thực tế:</strong>{' '}
                      <span className="font-hanzi text-sm font-semibold">{sampleEx.hanzi}</span> (
                      {sampleEx.pinyin}) — {sampleEx.translationVi}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <GameNavFooter
            currentIndex={idx}
            total={deck.length}
            canGoPrev={idx > 0}
            canGoNext={Boolean(currentRecord)}
            isLast={idx + 1 >= deck.length}
            showRetry={Boolean(currentRecord)}
            onPrev={() => setIdx((i) => Math.max(0, i - 1))}
            onRetry={handleRetryCurrent}
            onNext={handleNext}
          />
        </div>
      ) : (
        /* Mode 2: Lật thẻ 4 chiều FSRS */
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5 text-center">
          <div
            onClick={() => setFlipped((f) => !f)}
            className="cursor-pointer min-h-[210px] flex flex-col items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-6 transition hover:border-brand-400"
          >
            <span className="text-[11px] font-bold uppercase text-brand-500 mb-3">
              {flipped ? 'Mặt sau — Đáp án & Ví dụ' : `Mặt trước · ${DIR_LABELS[direction]}`}
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
                {sampleEx && (
                  <div className="text-xs text-slate-500 pt-1">
                    VD: <span className="font-hanzi">{sampleEx.hanzi}</span> — {sampleEx.translationVi}
                  </div>
                )}
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

          <GameNavFooter
            currentIndex={idx}
            total={deck.length}
            canGoPrev={idx > 0}
            canGoNext={true}
            isLast={idx + 1 >= deck.length}
            onPrev={() => setIdx((i) => Math.max(0, i - 1))}
            onNext={handleNext}
            nextLabel={idx + 1 >= deck.length ? 'Hoàn thành bộ thẻ' : 'Thẻ tiếp theo'}
          />
        </div>
      )}
    </div>
  );
};
