import React, { useEffect, useMemo, useState } from 'react';
import { SkipForward, Volume2 } from 'lucide-react';
import type { DictionaryEntry } from '@/types';
import { speakChinese } from '@/services/tts/ttsService';
import { Rating, recordStudyActivity, recordVocabReview } from '@/services/fsrs/fsrsService';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { PeekableText } from '@/components/common/PeekableText';
import { HanziStrokePlayer } from '@/features/writing/HanziStrokePlayer';
import { isHanziChar } from '@/utils/pinyin';
import { shuffleArray } from './arcadeUtils';

interface BlindStrokeGameProps {
  words: DictionaryEntry[];
  onFinish: (stats: { correct: number; total: number; exp: number }) => void;
}

/**
 * Game 6: Muscle Memory — Luyện viết mù (Blind Stroke Challenge)
 * Hiện nghĩa + phát âm (ẩn hoàn toàn mặt chữ), viết từng nét trên hanzi-writer không bóng mờ
 * (chỉ gợi ý 1 nét nếu sai 2 lần liên tiếp).
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
  const [correctCount, setCorrectCount] = useState(0);
  const [totalExp, setTotalExp] = useState(0);

  const currentWord = deck[wordIdx];
  const chars = useMemo(
    () => (currentWord ? Array.from(currentWord.simplified).filter(isHanziChar) : []),
    [currentWord]
  );
  const activeChar = chars[charIdx] || '';

  useEffect(() => {
    if (currentWord) {
      speakChinese(currentWord.simplified).catch(() => {});
    }
  }, [currentWord]);

  const finishCurrentWord = async (mistakes: number, skipped = false) => {
    if (!currentWord) return;
    const isGood = !skipped && mistakes <= 3;
    const grade = skipped
      ? Rating.Again
      : mistakes === 0
        ? Rating.Easy
        : mistakes <= 2
          ? Rating.Good
          : Rating.Hard;

    const res = await recordVocabReview(currentWord.id, currentWord.simplified, grade, {
      hardcore: hardcoreMode,
      baseExp: 15
    });

    const nextCorrect = isGood ? correctCount + 1 : correctCount;
    const nextExp = totalExp + res.expEarned;
    setCorrectCount(nextCorrect);
    setTotalExp(nextExp);

    if (wordIdx + 1 >= deck.length) {
      await recordStudyActivity({ gamesPlayed: 1 });
      onFinish({ correct: nextCorrect, total: deck.length, exp: nextExp });
    } else {
      setWordIdx((w) => w + 1);
      setCharIdx(0);
      setWordMistakes(0);
    }
  };

  const handleCharComplete = async ({ totalMistakes }: { totalMistakes: number }) => {
    const accMistakes = wordMistakes + totalMistakes;
    setWordMistakes(accMistakes);

    if (charIdx + 1 < chars.length) {
      window.setTimeout(() => setCharIdx((c) => c + 1), 650);
    } else {
      window.setTimeout(() => {
        finishCurrentWord(accMistakes, false);
      }, 850);
    }
  };

  if (!currentWord) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
        <span>Trí nhớ cơ bắp · Viết mù từng nét</span>
        <span>
          Từ {wordIdx + 1}/{deck.length} (Chữ {charIdx + 1}/{chars.length})
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

          {/* Tiến độ từng chữ trong từ ghép */}
          {chars.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-2">
              {chars.map((ch, idx) => (
                <span
                  key={idx}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-hanzi text-lg font-bold border ${
                    idx < charIdx
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                      : idx === charIdx
                        ? 'bg-brand-600 border-brand-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                  }`}
                >
                  {idx < charIdx ? ch : '?'}
                </span>
              ))}
            </div>
          )}
        </div>

        <HanziStrokePlayer
          key={`${currentWord.id}-${charIdx}`}
          char={activeChar}
          mode="quiz"
          blindMode={true}
          size={250}
          onQuizComplete={handleCharComplete}
        />

        <button
          type="button"
          onClick={() => finishCurrentWord(wordMistakes + 5, true)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-rose-500"
        >
          <SkipForward className="w-3.5 h-3.5" /> Quên hẳn chữ này — bỏ qua & ôn lại sớm
        </button>
      </div>
    </div>
  );
};
