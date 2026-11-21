import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Heart,
  Lightbulb,
  Loader2,
  Shield,
  Sparkles,
  Swords,
  Volume2,
  XCircle
} from 'lucide-react';
import type { DictionaryEntry } from '@/types';
import { speakChinese } from '@/services/tts/ttsService';
import { Rating, recordStudyActivity, recordVocabReview } from '@/services/fsrs/fsrsService';
import { gradeSentenceCreationAI } from '@/services/ai/aiTasks';
import { useAppStore } from '@/stores/useAppStore';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { HanziStrokePlayer } from '@/features/writing/HanziStrokePlayer';
import { containsHanzi, isHanziChar } from '@/utils/pinyin';
import { shuffleArray, type ArcadeSentence } from './arcadeUtils';
import { GameNavFooter } from './GameNavFooter';

interface LessonBossRaidGameProps {
  words: DictionaryEntry[];
  sentences: ArcadeSentence[];
  sourceLabel: string;
  onFinish: (stats: { correct: number; total: number; exp: number }) => void;
}

interface TurnHistoryEntry {
  isCorrect: boolean;
  pickedText?: string;
  explanationVi: string;
  damage: number;
}

/**
 * Game 7: Output Effect — Đấu Trùm Bài Học (4 Pha)
 * Nâng cấp: Không nhảy pha vội — dừng lại giải thích chi tiết từng đòn, cho phép "Làm lại câu này" & lùi xem lại các pha trước!
 */
export const LessonBossRaidGame: React.FC<LessonBossRaidGameProps> = ({
  words,
  sentences,
  sourceLabel,
  onFinish
}) => {
  const { isOnline, settings } = useAppStore();
  const hardcoreMode = useDisplayStore((s) => s.hardcoreMode);

  const deck = useMemo(() => shuffleArray(words).slice(0, 8), [words]);
  const mcOptionsByStep = useMemo(
    () =>
      Array.from({ length: 6 }, (_, s) => {
        const target = deck[s % Math.max(1, deck.length)];
        if (!target) return [];
        const others = shuffleArray(words.filter((w) => w.id !== target.id)).slice(0, 3);
        return shuffleArray([target, ...others]);
      }),
    [deck, words]
  );

  const [bossHp, setBossHp] = useState(100);
  const [hearts, setHearts] = useState(3);
  const [step, setStep] = useState(0); // 0,1 = Phase 1; 2,3 = Phase 2; 4 = Phase 3; 5 = Phase 4
  const [history, setHistory] = useState<Record<number, TurnHistoryEntry>>({});
  const [totalExp, setTotalExp] = useState(0);
  const [battleLog, setBattleLog] = useState<string>(
    'Trùm Bài Học xuất hiện! Hãy đánh bại qua 4 pha thử thách!'
  );
  const [sentenceInput, setSentenceInput] = useState('');
  const [grading, setGrading] = useState(false);
  const [strokeRetryKey, setStrokeRetryKey] = useState(0);

  const phase = step <= 1 ? 1 : step <= 3 ? 2 : step === 4 ? 3 : 4;
  const targetWord = deck[step % Math.max(1, deck.length)];
  const turnRecord = history[step] || null;
  const mcOptions = mcOptionsByStep[step] || [];

  const clozeItem = useMemo(() => {
    if (!targetWord) return null;
    const match = sentences.find((s) => s.targetWord.id === targetWord.id);
    if (match) return match;
    return {
      hanzi: `今天我学了“${targetWord.simplified}”，它的意思是${targetWord.meanings[0]}。`,
      pinyin: targetWord.pinyin,
      translationVi: `Hôm nay tôi học từ "${targetWord.meanings[0]}".`,
      targetWord
    };
  }, [targetWord, sentences]);

  useEffect(() => {
    if (phase === 1 && targetWord && !history[step]) {
      speakChinese(targetWord.simplified, { silentError: true }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step]);

  const applyHit = async (
    isCorrect: boolean,
    word: DictionaryEntry,
    damage: number,
    explanationVi: string,
    pickedText?: string
  ) => {
    if (turnRecord) return;
    setHistory((prev) => ({
      ...prev,
      [step]: { isCorrect, pickedText, explanationVi, damage }
    }));

    const res = await recordVocabReview(
      word.id,
      word.simplified,
      isCorrect ? Rating.Good : Rating.Again,
      { hardcore: hardcoreMode, baseExp: 14 }
    );
    setTotalExp((e) => e + res.expEarned);

    if (isCorrect) {
      setBossHp((hp) => Math.max(0, hp - damage));
      setBattleLog(`⚔️ Đòn chuẩn xác! Trùm mất ${damage} HP.`);
    } else {
      setHearts((h) => Math.max(0, h - 1));
      setBattleLog(`💔 Trùm phản công! Bạn mất 1 tim — hãy xem giải thích bên dưới hoặc thử lại!`);
    }
  };

  const handleRetryStep = () => {
    const prev = history[step];
    if (prev && !prev.isCorrect) {
      setHearts((h) => Math.min(3, h + 1));
    }
    setHistory((h) => {
      const next = { ...h };
      delete next[step];
      return next;
    });
    setStrokeRetryKey((k) => k + 1);
  };

  const handleNextStep = async () => {
    const isEnded = step >= 5 || bossHp <= 0 || hearts <= 0;
    if (isEnded) {
      const victory = hearts > 0 && (bossHp <= 0 || step >= 5);
      const bonus = victory ? (hardcoreMode ? 80 : 40) : 10;
      const correctCount = Object.values(history).filter((h) => h.isCorrect).length;
      await recordStudyActivity({ gamesPlayed: 1, expEarned: bonus });
      onFinish({
        correct: correctCount,
        total: 6,
        exp: totalExp + bonus
      });
    } else {
      setStep((s) => s + 1);
    }
  };

  const handlePhase4Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetWord || !sentenceInput.trim() || grading || turnRecord) return;
    setGrading(true);
    try {
      const text = sentenceInput.trim();
      if (isOnline && settings.geminiApiKey) {
        const res = await gradeSentenceCreationAI([targetWord.simplified], text);
        const passed = res.score >= 6;
        await applyHit(
          passed,
          targetWord,
          30,
          `AI chấm ${res.score}/10: ${res.summaryVi} · Cách nói tự nhiên hơn: ${res.spokenUpgrade.hanzi} (${res.spokenUpgrade.pinyin})`,
          text
        );
      } else {
        const hasKeyword = text.includes(targetWord.simplified);
        const hanziCount = Array.from(text).filter(isHanziChar).length;
        const passed =
          hasKeyword && containsHanzi(text) && hanziCount >= targetWord.simplified.length + 3;
        await applyHit(
          passed,
          targetWord,
          30,
          passed
            ? `Chấm Offline: Bạn đã dùng chính xác từ "${targetWord.simplified}" (${targetWord.meanings[0]}) trong câu hoàn chỉnh!`
            : `Chấm Offline: Câu cần chứa đúng từ "${targetWord.simplified}" và có ít nhất ${targetWord.simplified.length + 3} chữ Hán để tạo thành câu có nghĩa.`,
          text
        );
      }
    } catch {
      const passed = sentenceInput.includes(targetWord.simplified) && sentenceInput.length >= 5;
      await applyHit(
        passed,
        targetWord,
        30,
        passed
          ? `Đã dùng đúng từ "${targetWord.simplified}" trong câu!`
          : `Câu cần có từ "${targetWord.simplified}" và đủ ý nghĩa.`,
        sentenceInput
      );
    } finally {
      setGrading(false);
    }
  };

  if (!targetWord) return null;

  const isBattleOver = Boolean(turnRecord) && (step >= 5 || bossHp <= 0 || hearts <= 0);

  return (
    <div className="space-y-4">
      {/* Boss HP & Player Hearts HUD */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-rose-950 text-white p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-sm font-bold">Đấu Trùm · {sourceLabel}</div>
              <div className="text-[11px] text-rose-200">
                Lượt {step + 1}/6 · Pha {phase}/4:{' '}
                {phase === 1
                  ? 'Nghe chọn nhanh'
                  : phase === 2
                    ? 'Điền khuyết bài khóa'
                    : phase === 3
                      ? 'Viết mù từ khó'
                      : 'Đặt câu kết liễu'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <Heart
                key={i}
                className={`w-5 h-5 transition ${
                  i < hearts ? 'fill-rose-500 text-rose-500' : 'text-slate-600'
                }`}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] font-bold mb-1">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-amber-400" /> BOSS HP
            </span>
            <span>{bossHp} / 100</span>
          </div>
          <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-500"
              style={{ width: `${bossHp}%` }}
            />
          </div>
        </div>

        <p className="text-xs text-amber-200 bg-black/25 rounded-lg px-3 py-1.5">{battleLog}</p>
      </div>

      {/* Arena từng pha */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        {phase === 1 && (
          <div className="space-y-4 text-center">
            <h3 className="text-sm font-bold text-brand-600">
              PHA 1: Nghe âm thanh &amp; chọn chữ đúng!
            </h3>
            <button
              type="button"
              onClick={() => speakChinese(targetWord.simplified).catch(() => {})}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white px-6 py-3.5 text-sm font-bold shadow-sm"
            >
              <Volume2 className="w-5 h-5" /> Phát lại âm thanh
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              {mcOptions.map((opt) => {
                const isRight = opt.id === targetWord.id;
                const isPicked = turnRecord?.pickedText === opt.simplified;
                const cls = turnRecord
                  ? isRight
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : isPicked
                      ? 'bg-rose-50 border-rose-500 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
                      : 'opacity-45 border-slate-200 dark:border-slate-800'
                  : 'border-slate-200 dark:border-slate-700 hover:border-brand-500';
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={Boolean(turnRecord)}
                    onClick={() =>
                      applyHit(
                        opt.id === targetWord.id,
                        targetWord,
                        15,
                        `Âm vừa nghe là "${targetWord.simplified}" (${targetWord.pinyin} — ${targetWord.meanings.join('; ')}).${
                          opt.id !== targetWord.id
                            ? ` Bạn chọn "${opt.simplified}" (${opt.pinyin} — ${opt.meanings[0]}).`
                            : ''
                        }`,
                        opt.simplified
                      )
                    }
                    className={`rounded-xl border-2 p-3.5 font-hanzi text-2xl font-bold transition active:scale-95 ${cls}`}
                  >
                    <div>{opt.simplified}</div>
                    {turnRecord && (
                      <div className="font-sans text-[11px] font-medium opacity-80 mt-0.5">
                        {opt.pinyin} · {opt.meanings[0]}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase === 2 && clozeItem && (
          <div className="space-y-4 text-center">
            <h3 className="text-sm font-bold text-brand-600">
              PHA 2: Điền khuyết ngữ cảnh bài khóa!
            </h3>
            <div className="font-hanzi text-2xl font-bold">
              {turnRecord
                ? clozeItem.hanzi
                : clozeItem.hanzi.replace(targetWord.simplified, '【 ____ 】')}
            </div>
            {!hardcoreMode && (
              <p className="text-sm text-slate-500">{clozeItem.translationVi}</p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              {mcOptions.map((opt) => {
                const isRight = opt.id === targetWord.id;
                const isPicked = turnRecord?.pickedText === opt.simplified;
                const cls = turnRecord
                  ? isRight
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : isPicked
                      ? 'bg-rose-50 border-rose-500 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
                      : 'opacity-45 border-slate-200 dark:border-slate-800'
                  : 'border-slate-200 dark:border-slate-700 hover:border-brand-500';
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={Boolean(turnRecord)}
                    onClick={() =>
                      applyHit(
                        opt.id === targetWord.id,
                        targetWord,
                        15,
                        `Trong câu "${clozeItem.hanzi}" (${clozeItem.translationVi}), từ đúng là "${targetWord.simplified}" (${targetWord.pinyin}: ${targetWord.meanings[0]}).`,
                        opt.simplified
                      )
                    }
                    className={`rounded-xl border-2 p-3 font-hanzi text-2xl font-bold transition active:scale-95 ${cls}`}
                  >
                    <div>{opt.simplified}</div>
                    {turnRecord && (
                      <div className="font-sans text-[11px] font-medium opacity-80 mt-0.5">
                        {opt.pinyin} · {opt.meanings[0]}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase === 3 && (
          <div className="flex flex-col items-center space-y-3">
            <h3 className="text-sm font-bold text-brand-600">
              PHA 3: Viết mù chữ "{targetWord.meanings[0]}" ({targetWord.pinyin})!
            </h3>
            {!turnRecord && (
              <HanziStrokePlayer
                key={`${targetWord.id}-${strokeRetryKey}`}
                char={targetWord.simplified[0]}
                mode="quiz"
                blindMode={true}
                size={220}
                onQuizComplete={({ totalMistakes }) =>
                  applyHit(
                    totalMistakes <= 4,
                    targetWord,
                    20,
                    `Chữ "${targetWord.simplified[0]}" (${targetWord.pinyin} — ${targetWord.meanings[0]}), bạn hoàn thành với ${totalMistakes} lỗi nét.`
                  )
                }
              />
            )}
          </div>
        )}

        {phase === 4 && (
          <form onSubmit={handlePhase4Submit} className="space-y-4">
            <div className="text-center space-y-1">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                <Sparkles className="w-4 h-4" /> ĐÒN KẾT LIỄU BOSS (PHA 4)
              </span>
              <h3 className="text-base font-bold">
                Đặt 1 câu tiếng Trung hoàn chỉnh có sử dụng từ:
              </h3>
              <div className="font-hanzi text-4xl font-bold text-brand-600 py-1">
                {targetWord.simplified}
              </div>
              <p className="text-xs text-slate-500">
                {targetWord.pinyin} — {targetWord.meanings.join('; ')}
              </p>
            </div>

            <textarea
              rows={3}
              value={sentenceInput}
              onChange={(e) => setSentenceInput(e.target.value)}
              disabled={Boolean(turnRecord)}
              placeholder={`Viết 1 câu tiếng Trung có chứa "${targetWord.simplified}"...`}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-hanzi text-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            {!turnRecord && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  {isOnline && settings.geminiApiKey
                    ? 'Chấm chi tiết bằng Gemini AI'
                    : 'Chấm cục bộ Offline (không cần mạng)'}
                </span>
                <button
                  type="submit"
                  disabled={!sentenceInput.trim() || grading}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-amber-600 text-white px-5 py-2.5 text-sm font-bold shadow-md disabled:opacity-40"
                >
                  {grading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Tung đòn kết liễu!</span>
                </button>
              </div>
            )}
          </form>
        )}

        {/* Hộp giải thích chi tiết từng lượt đấu */}
        {turnRecord && (
          <div
            className={`rounded-2xl p-4 text-left text-xs space-y-1.5 border ${
              turnRecord.isCorrect
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-100'
                : 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-100'
            }`}
          >
            <div className="font-bold text-sm flex items-center gap-1.5">
              {turnRecord.isCorrect ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>
                {turnRecord.isCorrect
                  ? `Đòn đánh thành công (-${turnRecord.damage} HP Boss)!`
                  : 'Trượt đòn — Xem giải thích để rút kinh nghiệm:'}
              </span>
            </div>
            <div className="flex items-start gap-1.5 leading-relaxed">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>{turnRecord.explanationVi}</span>
            </div>
          </div>
        )}

        <GameNavFooter
          currentIndex={step}
          total={6}
          canGoPrev={step > 0}
          canGoNext={Boolean(turnRecord)}
          isLast={isBattleOver}
          showRetry={Boolean(turnRecord) && !turnRecord.isCorrect}
          onPrev={() => setStep((s) => Math.max(0, s - 1))}
          onRetry={handleRetryStep}
          onNext={handleNextStep}
          nextLabel={isBattleOver ? 'Tổng kết trận đấu' : 'Lượt tiếp theo'}
        />
      </div>
    </div>
  );
};
