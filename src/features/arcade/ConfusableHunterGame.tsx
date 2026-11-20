import React, { useMemo, useState } from 'react';
import { CheckCircle2, Eye, Volume2, XCircle } from 'lucide-react';
import { CONFUSABLE_GROUPS } from '@/data/confusables';
import { db } from '@/db/database';
import { speakChinese } from '@/services/tts/ttsService';
import { Rating, recordStudyActivity, recordVocabReview } from '@/services/fsrs/fsrsService';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { PeekableText } from '@/components/common/PeekableText';
import { shuffleArray } from './arcadeUtils';

interface ConfusableHunterGameProps {
  onFinish: (stats: { correct: number; total: number; exp: number }) => void;
}

/**
 * Game 5: Interleaving — Truy tìm Giả mạo (Confusable Hunter)
 * Cố tình trộn các cặp chữ hình cận tự (买/卖, 己/已, 大/太/天, 人/入/八, 的/地/得, 在/再...)
 * và đồng âm khác nghĩa để chọn đúng theo ngữ cảnh.
 */
export const ConfusableHunterGame: React.FC<ConfusableHunterGameProps> = ({ onFinish }) => {
  const hardcoreMode = useDisplayStore((s) => s.hardcoreMode);

  const rounds = useMemo(() => {
    const list: Array<{
      groupTitle: string;
      groupType: 'visual' | 'homophone' | 'grammar';
      target: (typeof CONFUSABLE_GROUPS)[number]['items'][number];
      options: (typeof CONFUSABLE_GROUPS)[number]['items'];
    }> = [];

    for (const g of shuffleArray(CONFUSABLE_GROUPS).slice(0, 8)) {
      const target = g.items[Math.floor(Math.random() * g.items.length)];
      list.push({
        groupTitle: g.title,
        groupType: g.type,
        target,
        options: shuffleArray(g.items)
      });
    }
    return list;
  }, []);

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalExp, setTotalExp] = useState(0);

  const current = rounds[idx];

  const handlePick = async (hanzi: string) => {
    if (!current || picked) return;
    setPicked(hanzi);
    const isCorrect = hanzi === current.target.hanzi;
    speakChinese(current.target.exampleSentence).catch(() => {});

    const dictWord = await db.dictionary
      .where('simplified')
      .equals(current.target.hanzi)
      .first();
    let exp = isCorrect ? (hardcoreMode ? 24 : 12) : 2;
    if (dictWord) {
      const res = await recordVocabReview(
        dictWord.id,
        dictWord.simplified,
        isCorrect ? Rating.Good : Rating.Again,
        { hardcore: hardcoreMode, baseExp: 12 }
      );
      exp = res.expEarned;
    }

    const nextCorrect = isCorrect ? correctCount + 1 : correctCount;
    const nextExp = totalExp + exp;
    setCorrectCount(nextCorrect);
    setTotalExp(nextExp);

    window.setTimeout(async () => {
      if (idx + 1 >= rounds.length) {
        await recordStudyActivity({ gamesPlayed: 1 });
        onFinish({ correct: nextCorrect, total: rounds.length, exp: nextExp });
      } else {
        setIdx((i) => i + 1);
        setPicked(null);
      }
    }, 1900);
  };

  if (!current) return null;

  const masked = current.target.exampleSentence.replace(current.target.hanzi, '【 ？ 】');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-brand-500" />
          Truy tìm Giả mạo ·{' '}
          {current.groupType === 'visual'
            ? 'Hình cận tự'
            : current.groupType === 'homophone'
              ? 'Đồng âm khác nghĩa'
              : 'Ngữ pháp dễ nhầm'}
        </span>
        <span>
          Câu {idx + 1}/{rounds.length}
        </span>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-5 text-center">
        <div className="space-y-2">
          <div className="font-hanzi text-2xl sm:text-3xl font-bold leading-relaxed">
            {picked ? current.target.exampleSentence : masked}
          </div>
          <PeekableText
            kind="pinyin"
            forceHide={hardcoreMode}
            className="text-sm font-semibold text-brand-600 dark:text-brand-400"
          >
            {current.target.examplePinyin}
          </PeekableText>
          <PeekableText
            kind="meaning"
            forceHide={hardcoreMode}
            className="text-sm text-slate-600 dark:text-slate-300"
          >
            {current.target.exampleVi}
          </PeekableText>
          <button
            type="button"
            onClick={() => speakChinese(current.target.exampleSentence).catch(() => {})}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold"
          >
            <Volume2 className="w-3.5 h-3.5 text-brand-500" /> Nghe câu ngữ cảnh
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
          {current.options.map((opt) => {
            const isRight = opt.hanzi === current.target.hanzi;
            const isPicked = picked === opt.hanzi;
            const cls = picked
              ? isRight
                ? 'bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                : isPicked
                  ? 'bg-rose-50 border-rose-500 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200'
                  : 'opacity-45 border-slate-200 dark:border-slate-800'
              : 'border-slate-200 dark:border-slate-700 hover:border-brand-500 hover:bg-brand-50/40 dark:hover:bg-brand-950/30';

            return (
              <button
                key={opt.hanzi}
                type="button"
                disabled={Boolean(picked)}
                onClick={() => handlePick(opt.hanzi)}
                className={`rounded-2xl border-2 p-4 transition active:scale-95 flex flex-col items-center ${cls}`}
              >
                <span className="font-hanzi text-4xl font-bold">{opt.hanzi}</span>
                {picked && (
                  <span className="mt-1 text-xs font-semibold">
                    {opt.pinyin} · {opt.meaningVi}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {picked && (
          <div
            className={`rounded-xl p-3.5 text-left text-xs space-y-1 ${
              picked === current.target.hanzi
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5 text-sm">
              {picked === current.target.hanzi ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span>
                Đáp án: {current.target.hanzi} ({current.target.pinyin}) — {current.target.meaningVi}
              </span>
            </div>
            <p>Mẹo phân biệt: {current.target.tipVi}</p>
          </div>
        )}
      </div>
    </div>
  );
};
