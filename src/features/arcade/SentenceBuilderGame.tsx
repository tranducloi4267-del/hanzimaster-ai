import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, Volume2, XCircle } from 'lucide-react';
import { segmentChineseText } from '@/services/dictionary/tokenizer';
import { speakChinese } from '@/services/tts/ttsService';
import { Rating, recordStudyActivity, recordVocabReview } from '@/services/fsrs/fsrsService';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { shuffleArray, type ArcadeSentence } from './arcadeUtils';

interface SentenceBuilderGameProps {
  sentences: ArcadeSentence[];
  onFinish: (stats: { correct: number; total: number; exp: number }) => void;
}

/**
 * Game 3: Chunking & Sentence Mining — Ghép cầu Ngữ pháp
 * Chạm chọn các cụm từ bị xáo trộn để xếp đúng trật tự ngữ pháp tiếng Trung.
 * Ở chế độ Hardcore, ẩn nghĩa tiếng Việt và chỉ phát audio!
 */
export const SentenceBuilderGame: React.FC<SentenceBuilderGameProps> = ({
  sentences,
  onFinish
}) => {
  const hardcoreMode = useDisplayStore((s) => s.hardcoreMode);
  const deck = useMemo(() => shuffleArray(sentences).slice(0, 7), [sentences]);

  const [idx, setIdx] = useState(0);
  const [pickedIndices, setPickedIndices] = useState<number[]>([]);
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [correctCount, setCorrectCount] = useState(0);
  const [totalExp, setTotalExp] = useState(0);

  const current = deck[idx];

  const { targetChunks, shuffledChunks } = useMemo(() => {
    if (!current) return { targetChunks: [], shuffledChunks: [] };
    const clean = current.hanzi.replace(/[。？！，、,.!?]/g, '').trim();
    const segs = segmentChineseText(clean)
      .map((s) => s.text.trim())
      .filter(Boolean);
    // Gộp nếu quá nhiều mảnh (>8) để người chơi ghép mượt trên điện thoại
    const chunks: string[] = [];
    for (const s of segs) {
      if (chunks.length >= 6 && chunks[chunks.length - 1].length <= 2) {
        chunks[chunks.length - 1] += s;
      } else {
        chunks.push(s);
      }
    }
    return {
      targetChunks: chunks,
      shuffledChunks: shuffleArray(chunks.map((text, id) => ({ id, text })))
    };
  }, [current]);

  useEffect(() => {
    if (current && hardcoreMode) {
      speakChinese(current.hanzi).catch(() => {});
    }
  }, [current, hardcoreMode]);

  const handleCheck = async () => {
    if (!current || status !== 'idle') return;
    const built = pickedIndices.map((i) => shuffledChunks[i].text).join('');
    const expected = targetChunks.join('');
    const isCorrect = built === expected;
    setStatus(isCorrect ? 'correct' : 'wrong');

    const res = await recordVocabReview(
      current.targetWord.id,
      current.targetWord.simplified,
      isCorrect ? Rating.Good : Rating.Again,
      { hardcore: hardcoreMode, baseExp: 12 }
    );
    const nextCorrect = isCorrect ? correctCount + 1 : correctCount;
    const nextExp = totalExp + res.expEarned;
    setCorrectCount(nextCorrect);
    setTotalExp(nextExp);

    speakChinese(current.hanzi).catch(() => {});

    window.setTimeout(async () => {
      if (idx + 1 >= deck.length) {
        await recordStudyActivity({ gamesPlayed: 1 });
        onFinish({ correct: nextCorrect, total: deck.length, exp: nextExp });
      } else {
        setIdx((i) => i + 1);
        setPickedIndices([]);
        setStatus('idle');
      }
    }, 1400);
  };

  if (!current) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        Chưa đủ câu mẫu cho bộ nguồn này. Hãy chọn cấp HSK hoặc một bài khóa có câu hội thoại.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
        <span>Ghép cầu Ngữ pháp (Chunking)</span>
        <span>
          Câu {idx + 1}/{deck.length}
        </span>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-5">
        <div className="text-center space-y-2">
          {hardcoreMode ? (
            <button
              type="button"
              onClick={() => speakChinese(current.hanzi).catch(() => {})}
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 text-sm font-bold shadow-sm"
            >
              <Volume2 className="w-5 h-5" />
              Hardcore: Nghe âm thanh & ghép câu
            </button>
          ) : (
            <>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                "{current.translationVi}"
              </div>
              <button
                type="button"
                onClick={() => speakChinese(current.hanzi).catch(() => {})}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
              >
                <Volume2 className="w-3.5 h-3.5" /> Nghe gợi ý phát âm
              </button>
            </>
          )}
        </div>

        {/* Khu vực câu đã ghép */}
        <div className="min-h-[68px] rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 p-3 flex flex-wrap items-center gap-2">
          {pickedIndices.length === 0 ? (
            <span className="text-xs text-slate-400 mx-auto">
              Chạm lần lượt các mảnh từ bên dưới để xếp thành câu hoàn chỉnh...
            </span>
          ) : (
            pickedIndices.map((chunkIdx, order) => (
              <button
                key={`${chunkIdx}-${order}`}
                type="button"
                disabled={status !== 'idle'}
                onClick={() =>
                  setPickedIndices((prev) => prev.filter((_, i) => i !== order))
                }
                className="rounded-xl bg-brand-600 text-white px-3.5 py-2 font-hanzi text-lg font-bold shadow-sm active:scale-95 transition"
              >
                {shuffledChunks[chunkIdx].text}
              </button>
            ))
          )}
        </div>

        {/* Kho mảnh từ xáo trộn */}
        <div className="flex flex-wrap justify-center gap-2">
          {shuffledChunks.map((chunk, sIdx) => {
            const used = pickedIndices.includes(sIdx);
            return (
              <button
                key={chunk.id}
                type="button"
                disabled={used || status !== 'idle'}
                onClick={() => setPickedIndices((prev) => [...prev, sIdx])}
                className={`rounded-xl border-2 px-3.5 py-2 font-hanzi text-lg font-bold transition ${
                  used
                    ? 'opacity-25 border-slate-200 dark:border-slate-800'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-500 active:scale-95'
                }`}
              >
                {chunk.text}
              </button>
            );
          })}
        </div>

        {status !== 'idle' && (
          <div
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 ${
              status === 'correct'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
            }`}
          >
            {status === 'correct' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 shrink-0" />
            )}
            <span>
              {status === 'correct'
                ? `Chuẩn ngữ pháp! ${current.hanzi}`
                : `Đáp án chuẩn: ${current.hanzi} (${current.pinyin})`}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={pickedIndices.length === 0 || status !== 'idle'}
            onClick={() => setPickedIndices([])}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Xếp lại
          </button>
          <button
            type="button"
            disabled={pickedIndices.length !== shuffledChunks.length || status !== 'idle'}
            onClick={handleCheck}
            className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 text-sm font-bold shadow-sm disabled:opacity-40"
          >
            Kiểm tra câu
          </button>
        </div>
      </div>
    </div>
  );
};
