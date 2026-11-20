import React, { useEffect, useMemo, useState } from 'react';
import { Heart, Loader2, Shield, Sparkles, Swords, Volume2 } from 'lucide-react';
import type { DictionaryEntry } from '@/types';
import { speakChinese } from '@/services/tts/ttsService';
import { Rating, recordStudyActivity, recordVocabReview } from '@/services/fsrs/fsrsService';
import { gradeSentenceCreationAI } from '@/services/ai/aiTasks';
import { useAppStore } from '@/stores/useAppStore';
import { useDisplayStore } from '@/stores/useDisplayStore';
import { HanziStrokePlayer } from '@/features/writing/HanziStrokePlayer';
import { containsHanzi, isHanziChar } from '@/utils/pinyin';
import { shuffleArray, type ArcadeSentence } from './arcadeUtils';

interface LessonBossRaidGameProps {
  words: DictionaryEntry[];
  sentences: ArcadeSentence[];
  sourceLabel: string;
  onFinish: (stats: { correct: number; total: number; exp: number }) => void;
}

/**
 * Game 7: Output Effect — Đấu Trùm Bài Học (Lesson Boss Raid)
 * Boss có 100 HP, Người chơi có 3 Tim.
 * 4 pha liên hoàn:
 *  Pha 1: Nghe chọn nhanh (2 câu)
 *  Pha 2: Điền khuyết bài khóa (2 câu)
 *  Pha 3: Viết mù từ khó (1 chữ)
 *  Pha 4: Đặt 1 câu dùng từ khóa (chấm cục bộ khi offline, AI chấm chi tiết khi online)
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
  const [bossHp, setBossHp] = useState(100);
  const [hearts, setHearts] = useState(3);
  const [step, setStep] = useState(0); // 0,1 = Phase 1; 2,3 = Phase 2; 4 = Phase 3; 5 = Phase 4
  const [correctCount, setCorrectCount] = useState(0);
  const [totalExp, setTotalExp] = useState(0);
  const [battleLog, setBattleLog] = useState<string>('Trùm Bài Học xuất hiện! Hãy đánh bại qua 4 pha thử thách!');
  const [sentenceInput, setSentenceInput] = useState('');
  const [grading, setGrading] = useState(false);

  const phase = step <= 1 ? 1 : step <= 3 ? 2 : step === 4 ? 3 : 4;
  const targetWord = deck[step % Math.max(1, deck.length)];

  const mcOptions = useMemo(() => {
    if (!targetWord) return [];
    const others = shuffleArray(words.filter((w) => w.id !== targetWord.id)).slice(0, 3);
    return shuffleArray([targetWord, ...others]);
  }, [targetWord, words]);

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
    if (phase === 1 && targetWord) {
      speakChinese(targetWord.simplified).catch(() => {});
    }
  }, [phase, step, targetWord]);

  const finishBattle = async (victory: boolean, finalCorrect: number, finalExp: number) => {
    const bonus = victory ? (hardcoreMode ? 80 : 40) : 10;
    await recordStudyActivity({ gamesPlayed: 1, expEarned: bonus });
    onFinish({
      correct: finalCorrect,
      total: 6,
      exp: finalExp + bonus
    });
  };

  const applyHit = async (isCorrect: boolean, word: DictionaryEntry, damage: number, msg: string) => {
    const res = await recordVocabReview(
      word.id,
      word.simplified,
      isCorrect ? Rating.Good : Rating.Again,
      { hardcore: hardcoreMode, baseExp: 14 }
    );
    const nextCorrect = isCorrect ? correctCount + 1 : correctCount;
    const nextExp = totalExp + res.expEarned;
    setCorrectCount(nextCorrect);
    setTotalExp(nextExp);

    if (isCorrect) {
      const nextHp = Math.max(0, bossHp - damage);
      setBossHp(nextHp);
      setBattleLog(`⚔️ Đòn chuẩn xác! Trùm mất ${damage} HP. ${msg}`);
      if (step >= 5 || nextHp === 0) {
        window.setTimeout(() => finishBattle(true, nextCorrect, nextExp), 900);
      } else {
        setStep((s) => s + 1);
      }
    } else {
      const nextHearts = hearts - 1;
      setHearts(nextHearts);
      setBattleLog(`💔 Trùm phản công! Bạn mất 1 tim. ${msg}`);
      if (nextHearts <= 0) {
        window.setTimeout(() => finishBattle(false, nextCorrect, nextExp), 900);
      } else if (step < 5) {
        setStep((s) => s + 1);
      }
    }
  };

  const handlePhase4Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetWord || !sentenceInput.trim() || grading) return;
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
          `AI chấm ${res.score}/10: ${res.summaryVi} (Gợi ý hay hơn: ${res.spokenUpgrade.hanzi})`
        );
      } else {
        // Chấm cục bộ Offline thông minh: kiểm tra có từ khóa, độ dài hợp lý & chữ Hán
        const hasKeyword = text.includes(targetWord.simplified);
        const hanziCount = Array.from(text).filter(isHanziChar).length;
        const passed = hasKeyword && containsHanzi(text) && hanziCount >= targetWord.simplified.length + 3;
        await applyHit(
          passed,
          targetWord,
          30,
          passed
            ? 'Chấm cục bộ Offline: Đã dùng đúng từ khóa trong câu hoàn chỉnh!'
            : `Chấm Offline: Câu cần chứa từ "${targetWord.simplified}" và dài hơn ít nhất 4 chữ Hán.`
        );
      }
    } catch {
      const passed = sentenceInput.includes(targetWord.simplified) && sentenceInput.length >= 5;
      await applyHit(passed, targetWord, 30, 'Đã đánh giá câu ở chế độ dự phòng cục bộ.');
    } finally {
      setGrading(false);
    }
  };

  if (!targetWord) return null;

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
                Pha {phase}/4:{' '}
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

        {/* Thanh máu Boss */}
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
              PHA 1: Nghe âm thanh & chọn nhanh chữ đúng!
            </h3>
            <button
              type="button"
              onClick={() => speakChinese(targetWord.simplified).catch(() => {})}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white px-6 py-3.5 text-sm font-bold shadow-sm"
            >
              <Volume2 className="w-5 h-5" /> Phát lại âm thanh
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              {mcOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    applyHit(
                      opt.id === targetWord.id,
                      targetWord,
                      15,
                      `Đáp án: ${targetWord.simplified} (${targetWord.meanings[0]})`
                    )
                  }
                  className="rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-brand-500 p-3.5 font-hanzi text-2xl font-bold transition active:scale-95"
                >
                  {opt.simplified}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 2 && clozeItem && (
          <div className="space-y-4 text-center">
            <h3 className="text-sm font-bold text-brand-600">
              PHA 2: Điền khuyết ngữ cảnh bài khóa!
            </h3>
            <div className="font-hanzi text-2xl font-bold">
              {clozeItem.hanzi.replace(targetWord.simplified, '【 ____ 】')}
            </div>
            {!hardcoreMode && (
              <p className="text-sm text-slate-500">{clozeItem.translationVi}</p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              {mcOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    applyHit(
                      opt.id === targetWord.id,
                      targetWord,
                      15,
                      `Từ đúng: ${targetWord.simplified}`
                    )
                  }
                  className="rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-brand-500 p-3 font-hanzi text-2xl font-bold transition active:scale-95"
                >
                  {opt.simplified}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 3 && (
          <div className="flex flex-col items-center space-y-3">
            <h3 className="text-sm font-bold text-brand-600">
              PHA 3: Viết mù chữ "{targetWord.meanings[0]}" ({targetWord.pinyin})!
            </h3>
            <HanziStrokePlayer
              char={targetWord.simplified[0]}
              mode="quiz"
              blindMode={true}
              size={220}
              onQuizComplete={({ totalMistakes }) =>
                applyHit(
                  totalMistakes <= 4,
                  targetWord,
                  20,
                  `Hoàn thành viết mù chữ "${targetWord.simplified[0]}" (${totalMistakes} lỗi nét)`
                )
              }
            />
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
              placeholder={`Viết 1 câu tiếng Trung có chứa "${targetWord.simplified}"...`}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-hanzi text-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

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
          </form>
        )}
      </div>
    </div>
  );
};
