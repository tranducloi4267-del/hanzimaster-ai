import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Lightbulb,
  RotateCcw,
  Undo2,
  Volume2,
  XCircle
} from 'lucide-react';
import { segmentChineseText } from '@/services/dictionary/tokenizer';
import { parseUsageDetails } from '@/services/dictionary/dictionaryService';
import { speakChinese } from '@/services/tts/ttsService';
import { Rating, recordStudyActivity, recordVocabReview } from '@/services/fsrs/fsrsService';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { shuffleArray, type ArcadeSentence } from './arcadeUtils';
import { GameNavFooter } from './GameNavFooter';

interface SentenceBuilderGameProps {
  sentences: ArcadeSentence[];
  onFinish: (stats: { correct: number; total: number; exp: number }) => void;
}

interface BuilderHistoryEntry {
  pickedIndices: number[];
  builtText: string;
  status: 'correct' | 'wrong';
}

/**
 * Game 3: Chunking & Sentence Mining — Ghép cầu Ngữ pháp
 * Nâng cấp: Lùi từng mảnh đã chọn, giải thích trật tự câu, làm lại câu sai, quay lại câu trước & câu tiếp theo.
 */
export const SentenceBuilderGame: React.FC<SentenceBuilderGameProps> = ({
  sentences,
  onFinish
}) => {
  const hardcoreMode = useDisplayStore((s) => s.hardcoreMode);
  const deck = useMemo(() => shuffleArray(sentences).slice(0, 7), [sentences]);

  // Cố định mảng các mảnh xáo trộn cho mỗi câu để khi bấm "Câu trước" giữ đúng trạng thái
  const preparedDeck = useMemo(
    () =>
      deck.map((item) => {
        const clean = item.hanzi.replace(/[。？！，、,.!?]/g, '').trim();
        const segs = segmentChineseText(clean)
          .map((s) => s.text.trim())
          .filter(Boolean);
        const chunks: string[] = [];
        for (const s of segs) {
          if (chunks.length >= 6 && chunks[chunks.length - 1].length <= 2) {
            chunks[chunks.length - 1] += s;
          } else {
            chunks.push(s);
          }
        }
        return {
          item,
          targetChunks: chunks,
          shuffledChunks: shuffleArray(chunks.map((text, id) => ({ id, text })))
        };
      }),
    [deck]
  );

  const [idx, setIdx] = useState(0);
  const [pickedIndices, setPickedIndices] = useState<number[]>([]);
  const [history, setHistory] = useState<Record<number, BuilderHistoryEntry>>({});
  const [totalExp, setTotalExp] = useState(0);

  const prepared = preparedDeck[idx];
  const current = prepared?.item;
  const targetChunks = prepared?.targetChunks || [];
  const shuffledChunks = prepared?.shuffledChunks || [];
  const record = history[idx] || null;
  const status: 'idle' | 'correct' | 'wrong' = record ? record.status : 'idle';

  useEffect(() => {
    const saved = history[idx];
    setPickedIndices(saved ? saved.pickedIndices : []);
    if (current && hardcoreMode && !saved) {
      speakChinese(current.hanzi, { silentError: true }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const handleCheck = async () => {
    if (!current || status !== 'idle') return;
    const built = pickedIndices.map((i) => shuffledChunks[i].text).join('');
    const expected = targetChunks.join('');
    const isCorrect = built === expected;

    setHistory((prev) => ({
      ...prev,
      [idx]: {
        pickedIndices: [...pickedIndices],
        builtText: built,
        status: isCorrect ? 'correct' : 'wrong'
      }
    }));

    const res = await recordVocabReview(
      current.targetWord.id,
      current.targetWord.simplified,
      isCorrect ? Rating.Good : Rating.Again,
      { hardcore: hardcoreMode, baseExp: 12 }
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
    setPickedIndices([]);
  };

  const handleNext = async () => {
    if (idx + 1 >= deck.length) {
      const correctCount = Object.values(history).filter((h) => h.status === 'correct').length;
      await recordStudyActivity({ gamesPlayed: 1 });
      onFinish({ correct: correctCount, total: deck.length, exp: totalExp });
    } else {
      setIdx((i) => i + 1);
    }
  };

  if (!current) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        Chưa đủ câu mẫu cho bộ nguồn này. Hãy chọn cấp HSK hoặc một bài khóa có câu hội thoại.
      </div>
    );
  }

  const usage = parseUsageDetails(current.targetWord);

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
              Hardcore: Nghe âm thanh &amp; ghép câu
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

        {/* Khu vực câu đã ghép (chạm mảnh nào gỡ ngay mảnh đó!) */}
        <div className="min-h-[68px] rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 p-3 flex flex-wrap items-center gap-2">
          {pickedIndices.length === 0 ? (
            <span className="text-xs text-slate-400 mx-auto">
              Chạm lần lượt các mảnh từ bên dưới để xếp thành câu (chạm lại mảnh đã xếp để bỏ ra)...
            </span>
          ) : (
            pickedIndices.map((chunkIdx, order) => (
              <button
                key={`${chunkIdx}-${order}`}
                type="button"
                disabled={status !== 'idle'}
                onClick={() => setPickedIndices((prev) => prev.filter((_, i) => i !== order))}
                className="rounded-xl bg-brand-600 text-white px-3.5 py-2 font-hanzi text-lg font-bold shadow-sm active:scale-95 transition"
                title="Chạm để gỡ mảnh này"
              >
                {shuffledChunks[chunkIdx]?.text}
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

        {/* Nút hoàn tác 1 bước / Xếp lại / Kiểm tra khi chưa nộp */}
        {status === 'idle' && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pickedIndices.length === 0}
                onClick={() => setPickedIndices((prev) => prev.slice(0, -1))}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                <Undo2 className="w-3.5 h-3.5" /> Lùi 1 bước
              </button>
              <button
                type="button"
                disabled={pickedIndices.length === 0}
                onClick={() => setPickedIndices([])}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Xếp lại hết
              </button>
            </div>
            <button
              type="button"
              disabled={pickedIndices.length !== shuffledChunks.length}
              onClick={handleCheck}
              className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 text-sm font-bold shadow-sm disabled:opacity-40"
            >
              Kiểm tra câu
            </button>
          </div>
        )}

        {/* Hộp giải thích trật tự ngữ pháp */}
        {record && (
          <div
            className={`rounded-2xl p-4 text-xs space-y-2 border ${
              record.status === 'correct'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-100'
                : 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-100'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-sm flex items-center gap-1.5">
                {record.status === 'correct' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span>
                  {record.status === 'correct'
                    ? 'Chuẩn trật tự ngữ pháp!'
                    : 'Trật tự các cụm từ chưa chuẩn — Xem giải thích bên dưới:'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => speakChinese(current.hanzi).catch(() => {})}
                className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/70 text-brand-600 shrink-0"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-start gap-1.5 leading-relaxed">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                {record.status === 'wrong' && (
                  <div>
                    <strong>Câu bạn ghép:</strong>{' '}
                    <span className="font-hanzi text-sm line-through opacity-80">
                      {record.builtText}
                    </span>
                  </div>
                )}
                <div>
                  <strong>Câu đúng chuẩn:</strong>{' '}
                  <span className="font-hanzi text-base font-bold">{current.hanzi}</span> (
                  {current.pinyin})
                </div>
                <div>
                  <strong>Thứ tự cụm từ:</strong>{' '}
                  <span className="font-hanzi font-semibold">{targetChunks.join(' → ')}</span>
                </div>
                <div>
                  <strong>Nghĩa &amp; từ trọng tâm:</strong> "{current.translationVi}" · Từ khóa{' '}
                  <strong className="font-hanzi">{current.targetWord.simplified}</strong> (
                  {current.targetWord.pinyin}: {current.targetWord.meanings[0]}).
                  {usage.senses?.[0]?.grammarPattern && (
                    <span> Mẫu câu: {usage.senses[0].grammarPattern}.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <GameNavFooter
          currentIndex={idx}
          total={deck.length}
          canGoPrev={idx > 0}
          canGoNext={Boolean(record)}
          isLast={idx + 1 >= deck.length}
          showRetry={Boolean(record)}
          onPrev={() => setIdx((i) => Math.max(0, i - 1))}
          onRetry={handleRetry}
          onNext={handleNext}
        />
      </div>
    </div>
  );
};
