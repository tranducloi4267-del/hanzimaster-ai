import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, Lightbulb, Volume2 } from 'lucide-react';
import type { DictionaryEntry } from '@/types';
import { speakChinese } from '@/services/tts/ttsService';
import { Rating, recordStudyActivity, recordVocabReview } from '@/services/fsrs/fsrsService';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { PeekableText } from '@/components/common/PeekableText';
import { HanziStrokePlayer } from '@/features/writing/HanziStrokePlayer';
import { isHanziChar } from '@/utils/pinyin';
import { shuffleArray } from './arcadeUtils';
import { GameNavFooter } from './GameNavFooter';

interface BlindStrokeGameProps {
  words: DictionaryEntry[];
  onFinish: (stats: { correct: number; total: number; exp: number }) => void;
}

interface BlindWordRecord {
  mistakes: number;
  skipped: boolean;
  isGood: boolean;
}

/**
 * Game 6: Muscle Memory — Luyện viết mù (Blind Stroke Challenge)
 * Nâng cấp: Không tự nhảy câu vội, hiện giải thích mặt chữ/Pinyin/Hán-Việt sau khi viết xong,
 * có nút Viết lại từ này & quay lại Từ trước / sang Từ tiếp theo.
 */
export const BlindStrokeGame: React.FC<BlindStrokeGameProps> = ({ words, onFinish }) => {
  const hardcoreMode = useDisplayStore((s) => s.hardcoreMode);
  const deck = useMemo(
    () =>
      shuffleArray(words)
        .filter((w) => Array.from(w.simplified).some(isHanziChar))
        .slice(0, 6),
    [words]
  );

  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [wordMistakes, setWordMistakes] = useState(0);
  const [attemptVersion, setAttemptVersion] = useState(0);
  const [history, setHistory] = useState<Record<number, BlindWordRecord>>({});
  const [totalExp, setTotalExp] = useState(0);

  const currentWord = deck[wordIdx];
  const record = history[wordIdx] || null;
  const chars = useMemo(
    () => (currentWord ? Array.from(currentWord.simplified).filter(isHanziChar) : []),
    [currentWord]
  );
  const activeChar = chars[charIdx] || '';

  useEffect(() => {
    setCharIdx(0);
    setWordMistakes(0);
    if (currentWord && !history[wordIdx]) {
      speakChinese(currentWord.simplified, { silentError: true }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordIdx]);

  const completeWord = async (mistakes: number, skipped = false) => {
    if (!currentWord || record) return;
    const isGood = !skipped && mistakes <= 3;
    const grade = skipped
      ? Rating.Again
      : mistakes === 0
        ? Rating.Easy
        : mistakes <= 2
          ? Rating.Good
          : Rating.Hard;

    setHistory((prev) => ({
      ...prev,
      [wordIdx]: { mistakes, skipped, isGood }
    }));

    const res = await recordVocabReview(currentWord.id, currentWord.simplified, grade, {
      hardcore: hardcoreMode,
      baseExp: 15
    });
    setTotalExp((e) => e + res.expEarned);
    speakChinese(currentWord.simplified, { silentError: true }).catch(() => {});
  };

  const handleCharComplete = async ({ totalMistakes }: { totalMistakes: number }) => {
    const accMistakes = wordMistakes + totalMistakes;
    setWordMistakes(accMistakes);

    if (charIdx + 1 < chars.length) {
      setCharIdx((c) => c + 1);
    } else {
      await completeWord(accMistakes, false);
    }
  };

  const handleRetryWord = () => {
    setHistory((prev) => {
      const next = { ...prev };
      delete next[wordIdx];
      return next;
    });
    setCharIdx(0);
    setWordMistakes(0);
    setAttemptVersion((v) => v + 1);
  };

  const handleNext = async () => {
    if (wordIdx + 1 >= deck.length) {
      const correctCount = Object.values(history).filter((h) => h.isGood).length;
      await recordStudyActivity({ gamesPlayed: 1 });
      onFinish({ correct: correctCount, total: deck.length, exp: totalExp });
    } else {
      setWordIdx((w) => w + 1);
    }
  };

  if (!currentWord) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
        <span>Trí nhớ cơ bắp · Viết mù từng nét</span>
        <span>
          Từ {wordIdx + 1}/{deck.length} (Chữ {Math.min(charIdx + 1, chars.length)}/{chars.length})
        </span>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col items-center space-y-4">
        <div className="text-center space-y-1.5">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {currentWord.meanings.join('; ')}
          </div>
          <div className="flex items-center justify-center gap-2">
            <PeekableText
              kind="pinyin"
              forceHide={hardcoreMode}
              inline
              className="text-base font-semibold text-brand-600"
            >
              {currentWord.pinyin}
            </PeekableText>
            {currentWord.hanViet && (
              <PeekableText
                kind="hanviet"
                forceHide={hardcoreMode}
                inline
                className="text-xs font-bold uppercase text-amber-600"
              >
                · {currentWord.hanViet}
              </PeekableText>
            )}
          </div>

          <button
            type="button"
            onClick={() => speakChinese(currentWord.simplified).catch(() => {})}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-300 px-3.5 py-1.5 text-xs font-bold"
          >
            <Volume2 className="w-4 h-4" />
            Nghe phát âm ({chars.length} chữ)
          </button>

          {chars.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-2">
              {chars.map((ch, i) => (
                <span
                  key={i}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-hanzi text-lg font-bold border ${
                    record || i < charIdx
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                      : i === charIdx
                        ? 'bg-brand-600 border-brand-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                  }`}
                >
                  {record || i < charIdx ? ch : '?'}
                </span>
              ))}
            </div>
          )}
        </div>

        {!record ? (
          <>
            <HanziStrokePlayer
              key={`${currentWord.id}-${charIdx}-${attemptVersion}`}
              char={activeChar}
              mode="quiz"
              blindMode={true}
              size={250}
              onQuizComplete={handleCharComplete}
            />
            <button
              type="button"
              onClick={() => completeWord(wordMistakes + 5, true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-amber-600"
            >
              <Eye className="w-3.5 h-3.5" /> Quên mặt chữ — Hiện đáp án &amp; đưa vào Từ quên
            </button>
          </>
        ) : (
          <div className="w-full rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800 p-4 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-sm flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {record.skipped
                    ? `Đáp án chữ cần nhớ: ${currentWord.simplified} (đã tự lưu vào Từ quên)`
                    : `Hoàn thành viết "${currentWord.simplified}" (${record.mistakes} lỗi nét)!`}
                </span>
              </div>
              <span className="font-hanzi text-3xl font-bold text-brand-600">
                {currentWord.simplified}
              </span>
            </div>
            <div className="flex items-start gap-1.5 text-slate-700 dark:text-slate-300">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong>Ghi nhớ mặt chữ:</strong>{' '}
                <strong className="font-hanzi text-sm">{currentWord.simplified}</strong> (
                {currentWord.pinyin}
                {currentWord.hanViet ? ` · Hán-Việt: ${currentWord.hanViet}` : ''}) —{' '}
                {currentWord.meanings.join('; ')}. Bộ thủ chính:{' '}
                <strong className="font-hanzi">{currentWord.radical || '—'}</strong> (
                {currentWord.strokesCount} nét).
              </div>
            </div>
          </div>
        )}

        <div className="w-full">
          <GameNavFooter
            currentIndex={wordIdx}
            total={deck.length}
            canGoPrev={wordIdx > 0}
            canGoNext={Boolean(record)}
            isLast={wordIdx + 1 >= deck.length}
            showRetry={Boolean(record)}
            onPrev={() => setWordIdx((w) => Math.max(0, w - 1))}
            onRetry={handleRetryWord}
            onNext={handleNext}
            nextLabel={wordIdx + 1 >= deck.length ? 'Hoàn thành luyện viết' : 'Từ tiếp theo'}
          />
        </div>
      </div>
    </div>
  );
};
