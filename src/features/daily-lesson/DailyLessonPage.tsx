import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle2,
  Gamepad2,
  Loader2,
  Mic,
  RefreshCw,
  Send,
  Sparkles,
  Volume2,
  CalendarDays
} from 'lucide-react';
import { db } from '@/db/database';
import { pickDailyTargetWords, recordStudyActivity } from '@/services/fsrs/fsrsService';
import { parseUsageDetails } from '@/services/dictionary/dictionaryService';
import { generateDailyLessonAI, gradeReadingAnswerAI } from '@/services/ai/aiTasks';
import { speakChinese } from '@/services/tts/ttsService';
import { startChineseSpeechSession, type ActiveRecordingSession } from '@/services/stt/sttService';
import { useAppStore } from '@/stores/useAppStore';
import type { DictionaryEntry, LessonContent, LessonItem } from '@/types';
import { createId, getTodayDateString } from '@/utils/pinyin';
import { DisplayControlBar } from '@/components/common/DisplayControlBar';
import { InteractiveHanziText } from '@/components/common/InteractiveHanziText';
import { PeekableText } from '@/components/common/PeekableText';

function buildOfflineLessonContent(
  words: DictionaryEntry[],
  level: number
): { title: string; content: LessonContent } {
  const lines = words.slice(0, 7).map((w, idx) => {
    const details = parseUsageDetails(w);
    const ex = details.senses?.[0]?.examples?.[0];
    return {
      speaker: idx % 2 === 0 ? '小明 (Tiểu Minh)' : '小兰 (Tiểu Lan)',
      hanzi: ex?.hanzi || `今天我学会了“${w.simplified}”这个词。`,
      pinyin: ex?.pinyin || `Jīntiān wǒ xuéhuìle "${w.pinyin}" zhège cí.`,
      translationVi: ex?.translationVi || `Hôm nay tôi đã học từ "${w.meanings[0]}".`
    };
  });

  const grammarPoints = words
    .slice(0, 2)
    .map((w) => {
      const details = parseUsageDetails(w);
      const s = details.senses?.[0];
      return {
        pattern: s?.grammarPattern || `Cách dùng từ ${w.simplified}`,
        explanationVi: `${w.simplified} (${w.pinyin}): ${s?.meaningVi || w.meanings.join('; ')}`,
        exampleHanzi: s?.examples?.[0]?.hanzi || lines[0]?.hanzi || '',
        examplePinyin: s?.examples?.[0]?.pinyin || lines[0]?.pinyin || '',
        exampleVi: s?.examples?.[0]?.translationVi || lines[0]?.translationVi || ''
      };
    });

  const questions = words.slice(0, 3).map((w, idx) => ({
    id: `q_${idx + 1}`,
    questionHanzi: `请你用“${w.simplified}”造一个简短的句子，或者复述课文里包含“${w.simplified}”的那句话。`,
    questionPinyin: `Qǐng nǐ yòng "${w.pinyin}" zào yī gè jiǎnduǎn de jùzi.`,
    questionVi: `Hãy đặt 1 câu ngắn dùng từ "${w.simplified}" (${w.meanings[0]}) hoặc nhắc lại câu mẫu trong bài.`,
    sampleAnswerHanzi: lines[idx]?.hanzi || `我会用${w.simplified}。`,
    sampleAnswerPinyin: lines[idx]?.pinyin || w.pinyin,
    sampleAnswerVi: lines[idx]?.translationVi || w.meanings[0]
  }));

  return {
    title: `Bài tổng hợp HSK ${level} hôm nay (${words.length} từ mục tiêu)`,
    content: {
      topic: 'Tổng hợp mẫu câu thực tế Offline',
      summaryVi:
        'Bài học được tổng hợp tự động từ các câu mẫu chuẩn trong kho Offline của bạn. Khi có mạng và Gemini API Key, bạn có thể bấm "Tạo bài khóa mới bằng AI" để sinh câu chuyện hội thoại hoàn toàn mới!',
      lines,
      grammarPoints,
      questions
    }
  };
}

export const DailyLessonPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings, isOnline, pushToast, setActiveArcadeLessonId, openSplitWord } = useAppStore();

  const [lesson, setLesson] = useState<LessonItem | null>(null);
  const [content, setContent] = useState<LessonContent | null>(null);
  const [targetEntries, setTargetEntries] = useState<DictionaryEntry[]>([]);
  const [splitStats, setSplitStats] = useState<{ newCount: number; reviewCount: number }>({
    newCount: 0,
    reviewCount: 0
  });

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [recordingQId, setRecordingQId] = useState<string | null>(null);
  const [voiceSession, setVoiceSession] = useState<ActiveRecordingSession | null>(null);

  const today = getTodayDateString();

  const loadOrCreateTodayLesson = async (forceAi = false, topic?: string) => {
    if (forceAi) setGenerating(true);
    else setLoading(true);

    try {
      const picked = await pickDailyTargetWords(
        settings.targetHskLevel || 1,
        settings.dailyWordGoal || 10
      );
      setTargetEntries(picked.words);
      setSplitStats({ newCount: picked.newCount, reviewCount: picked.reviewCount });

      // Kiểm tra xem hôm nay đã có bài khóa trong IndexedDB chưa
      if (!forceAi) {
        const existingToday = await db.lessons
          .where('date')
          .equals(today)
          .reverse()
          .sortBy('createdAt');
        const preferred =
          existingToday.find((l) => l.sourceType === 'daily-ai') ||
          existingToday.find((l) => l.sourceType === 'daily-offline');

        if (preferred) {
          const parsed = JSON.parse(preferred.contentJson) as LessonContent;
          setLesson(preferred);
          setContent(parsed);
          // Nếu đang có mạng + API Key và bài hiện tại mới chỉ là offline, tự nâng cấp bằng AI 1 lần
          if (
            preferred.sourceType === 'daily-offline' &&
            isOnline &&
            settings.geminiApiKey.trim()
          ) {
            setLoading(false);
            await loadOrCreateTodayLesson(true);
            return;
          }
          setLoading(false);
          return;
        }
      }

      const wordStrings = picked.words.map((w) => w.simplified);

      if (isOnline && settings.geminiApiKey.trim()) {
        try {
          const aiRes = await generateDailyLessonAI(
            today,
            settings.targetHskLevel || 1,
            wordStrings,
            topic,
            forceAi
          );
          const newLesson: LessonItem = {
            id: createId('lesson'),
            date: today,
            title: aiRes.title,
            level: settings.targetHskLevel || 1,
            contentJson: JSON.stringify(aiRes.content),
            targetWords: wordStrings,
            sourceType: 'daily-ai',
            completed: false,
            createdAt: Date.now()
          };
          await db.lessons.put(newLesson);
          setLesson(newLesson);
          setContent(aiRes.content);
          if (forceAi) {
            pushToast('Đã tạo bài khóa ngày mới bằng Gemini AI & lưu offline!', 'success');
          }
          return;
        } catch (err) {
          if (forceAi) {
            pushToast(
              err instanceof Error ? err.message : 'Lỗi tạo bài khóa AI',
              'error'
            );
            return;
          }
        }
      }

      // Tạo bài khóa Offline thực tế để người dùng luôn học được ngay không cần mạng
      const off = buildOfflineLessonContent(picked.words, settings.targetHskLevel || 1);
      const offlineLesson: LessonItem = {
        id: createId('lesson_off'),
        date: today,
        title: off.title,
        level: settings.targetHskLevel || 1,
        contentJson: JSON.stringify(off.content),
        targetWords: wordStrings,
        sourceType: 'daily-offline',
        completed: false,
        createdAt: Date.now()
      };
      await db.lessons.put(offlineLesson);
      setLesson(offlineLesson);
      setContent(off.content);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  useEffect(() => {
    loadOrCreateTodayLesson(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, settings.targetHskLevel, settings.dailyWordGoal]);

  const handleGradeQuestion = async (qId: string) => {
    if (!lesson || !content) return;
    const q = content.questions.find((item) => item.id === qId);
    const userAns = (answers[qId] || '').trim();
    if (!q || !userAns) return;

    setGradingId(qId);
    try {
      const passage = content.lines.map((l) => l.hanzi).join('\n');
      let feedback;
      if (isOnline && settings.geminiApiKey.trim()) {
        feedback = await gradeReadingAnswerAI(passage, q.questionHanzi, userAns);
      } else {
        const overlaps = Array.from(userAns).filter((c) =>
          q.sampleAnswerHanzi.includes(c)
        ).length;
        const ok = overlaps >= 2 || userAns.length >= 4;
        feedback = {
          score: ok ? 8 : 5,
          isCorrect: ok,
          commentVi: ok
            ? 'Chế độ Offline: Câu trả lời của bạn có ý đúng và dùng tiếng Trung hợp lệ. Hãy so sánh với câu mẫu bên dưới!'
            : 'Chế độ Offline: Câu trả lời hơi ngắn. Hãy thử viết dài hơn hoặc đối chiếu với câu mẫu!',
          naturalVersionHanzi: q.sampleAnswerHanzi,
          naturalVersionPinyin: q.sampleAnswerPinyin
        };
      }

      const updatedQuestions = content.questions.map((item) =>
        item.id === qId ? { ...item, userAnswer: userAns, aiFeedback: feedback } : item
      );
      const nextContent = { ...content, questions: updatedQuestions };
      setContent(nextContent);
      await db.lessons.update(lesson.id, { contentJson: JSON.stringify(nextContent) });
      await recordStudyActivity({ expEarned: feedback.isCorrect ? 15 : 5 });
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi chấm câu trả lời', 'error');
    } finally {
      setGradingId(null);
    }
  };

  const handleVoiceAnswer = async (qId: string) => {
    if (recordingQId === qId && voiceSession) {
      const res = await voiceSession.stopAndTranscribe();
      setVoiceSession(null);
      setRecordingQId(null);
      if (res.transcript) {
        setAnswers((prev) => ({ ...prev, [qId]: res.transcript }));
      } else {
        pushToast('Không thu được chữ Hán, bạn có thể gõ trực tiếp vào ô trả lời.', 'info');
      }
      return;
    }
    try {
      const sess = await startChineseSpeechSession();
      setVoiceSession(sess);
      setRecordingQId(qId);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Không bật được Micro', 'warning');
    }
  };

  const handlePlayTodayArcade = () => {
    if (lesson) {
      setActiveArcadeLessonId(lesson.id);
    }
    navigate('/arcade');
  };

  const handlePlayFullPassage = async () => {
    if (!content) return;
    const text = content.lines.map((l) => l.hanzi).join('。');
    try {
      await speakChinese(text);
    } catch {
      pushToast('Không thể phát âm bài khóa.', 'warning');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <p className="text-sm font-medium">Đang chuẩn bị lộ trình & bài khóa hôm nay ({today})...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header ngày mới + Đổi chủ đề / Tạo bài AI */}
      <div className="rounded-2xl bg-gradient-to-r from-brand-600 via-rose-600 to-amber-600 text-white p-5 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-white/15 px-2.5 py-1 rounded-full mb-2">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Bài học hôm nay · {today} · HSK {settings.targetHskLevel}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold leading-snug">
              {lesson?.title || 'Bài khóa hàng ngày'}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-rose-100 max-w-2xl">
              {content?.summaryVi}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePlayTodayArcade}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white text-brand-700 hover:bg-rose-50 px-4 py-2 text-xs font-bold shadow-sm transition active:scale-95"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Chơi Game ôn bài hôm nay</span>
            </button>
          </div>
        </div>

        {/* Đổi chủ đề & sinh bài mới bằng AI */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadOrCreateTodayLesson(true, customTopic);
          }}
          className="mt-4 pt-3 border-t border-white/15 flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="Nhập chủ đề muốn đổi (VD: Đặt phòng khách sạn, Gọi món lẩu, Phỏng vấn IT)..."
            className="flex-1 rounded-xl bg-white/15 placeholder:text-rose-100/80 text-white border border-white/25 px-3.5 py-2 text-xs focus:outline-none focus:bg-white/20"
          />
          <button
            type="submit"
            disabled={generating}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-950/35 hover:bg-slate-950/50 border border-white/25 px-4 py-2 text-xs font-bold transition disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Tạo thêm bài / Đổi chủ đề (AI)</span>
          </button>
        </form>
      </div>

      <DisplayControlBar />

      {/* Danh sách từ mục tiêu hôm nay (~60% mới + ~40% ôn/tử huyệt) */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Từ vựng mục tiêu hôm nay ({targetEntries.length} từ)</span>
          </h2>
          <span className="text-xs text-slate-500">
            {splitStats.newCount} từ mới HSK {settings.targetHskLevel} · {splitStats.reviewCount} từ ôn/tử huyệt
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {targetEntries.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                if (window.innerWidth >= 1024) openSplitWord(w.id, 'word');
                else navigate(`/dictionary?word=${encodeURIComponent(w.id)}`);
              }}
              className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:border-brand-500 px-3 py-1.5 text-left transition"
            >
              <div className="flex items-baseline gap-1.5">
                <span className="font-hanzi text-base font-bold text-slate-900 dark:text-white group-hover:text-brand-600">
                  {w.simplified}
                </span>
                <PeekableText kind="pinyin" inline className="text-[11px] text-brand-600 font-semibold">
                  {w.pinyin}
                </PeekableText>
              </div>
              <PeekableText kind="meaning" className="text-[11px] text-slate-500 line-clamp-1 max-w-[140px]">
                {w.meanings[0]}
              </PeekableText>
            </button>
          ))}
        </div>
      </div>

      {/* Nội dung Bài khóa / Hội thoại */}
      {content && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-base font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-brand-600" />
              <span>Bài khóa & Hội thoại (Chạm vào chữ bất kỳ để tra nhanh)</span>
            </h2>
            <button
              type="button"
              onClick={handlePlayFullPassage}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 px-3 py-1.5 text-xs font-bold hover:bg-brand-100"
            >
              <Volume2 className="w-4 h-4" />
              <span>Nghe toàn bài</span>
            </button>
          </div>

          <div className="space-y-3">
            {content.lines.map((line, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 p-3.5 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  {line.speaker && (
                    <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-1">
                      {line.speaker}
                    </div>
                  )}
                  <InteractiveHanziText
                    text={line.hanzi}
                    highlightWords={lesson?.targetWords || []}
                    sentencePinyin={line.pinyin}
                    sentenceTranslationVi={line.translationVi}
                    allowShadowing
                  />
                </div>
                <button
                  type="button"
                  onClick={() => speakChinese(line.hanzi).catch(() => {})}
                  className="shrink-0 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-brand-600"
                  title="Nghe câu này"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Ngữ pháp trọng tâm */}
          {content.grammarPoints.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Ngữ pháp trọng tâm trong bài
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {content.grammarPoints.map((gp, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/50 p-3.5 space-y-1.5"
                  >
                    <div className="font-hanzi text-sm font-bold text-amber-900 dark:text-amber-300">
                      {gp.pattern}
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300">{gp.explanationVi}</p>
                    <InteractiveHanziText
                      text={gp.exampleHanzi}
                      hanziClassName="text-sm font-medium"
                      sentencePinyin={gp.examplePinyin}
                      sentenceTranslationVi={gp.exampleVi}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Câu hỏi Đọc hiểu & Trả lời theo bài khóa */}
      {content && content.questions.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold">
            Trả lời câu hỏi đọc hiểu theo bài khóa ({content.questions.length} câu)
          </h2>

          <div className="space-y-4">
            {content.questions.map((q, idx) => (
              <div
                key={q.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <InteractiveHanziText
                      text={q.questionHanzi}
                      hanziClassName="text-base font-semibold"
                      sentencePinyin={q.questionPinyin}
                      sentenceTranslationVi={q.questionVi}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={answers[q.id] ?? q.userAnswer ?? ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Gõ hoặc bấm Mic trả lời bằng tiếng Trung..."
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-hanzi text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleVoiceAnswer(q.id)}
                    className={`p-2.5 rounded-xl border transition ${
                      recordingQId === q.id
                        ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title="Trả lời bằng giọng nói"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={gradingId === q.id || !(answers[q.id] ?? '').trim()}
                    onClick={() => handleGradeQuestion(q.id)}
                    className="inline-flex items-center gap-1 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 text-xs font-bold disabled:opacity-40"
                  >
                    {gradingId === q.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Chấm</span>
                  </button>
                </div>

                {q.aiFeedback && (
                  <div
                    className={`rounded-xl p-3 text-xs space-y-1.5 ${
                      q.aiFeedback.isCorrect
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Điểm: {q.aiFeedback.score}/10</span>
                    </div>
                    <p>{q.aiFeedback.commentVi}</p>
                    <div className="pt-1 border-t border-black/10 dark:border-white/10">
                      <span className="font-semibold">Cách nói tự nhiên hơn: </span>
                      <InteractiveHanziText
                        text={q.aiFeedback.naturalVersionHanzi}
                        hanziClassName="text-sm font-semibold"
                        sentencePinyin={q.aiFeedback.naturalVersionPinyin}
                        allowShadowing
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
