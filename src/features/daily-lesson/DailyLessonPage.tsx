import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Flag,
  Gamepad2,
  Layers,
  Loader2,
  Mic,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2
} from 'lucide-react';
import { db } from '@/db/database';
import {
  CURATED_LESSONS,
  LESSON_TOPIC_CATEGORIES,
  type CuratedLesson
} from '@/data/curatedLessons';
import {
  getForgottenWordsWithEntries,
  markWordForgotten,
  pickDailyTargetWords,
  recordStudyActivity,
  type ForgottenWordEntry
} from '@/services/fsrs/fsrsService';
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

function buildOfflineCustomLesson(
  words: DictionaryEntry[],
  level: number,
  topicLabel: string
): { title: string; content: LessonContent } {
  const lines = words.slice(0, 10).map((w, idx) => {
    const details = parseUsageDetails(w);
    const ex = details.senses?.[0]?.examples?.[0];
    return {
      speaker: idx % 2 === 0 ? '小明 (Tiểu Minh)' : '小兰 (Tiểu Lan)',
      hanzi: ex?.hanzi || `请记住“${w.simplified}”这个词，它在日常对话中很常用。`,
      pinyin: ex?.pinyin || `Qǐng jìzhù "${w.pinyin}" zhège cí, tā zài rìcháng duìhuà zhōng hěn chángyòng.`,
      translationVi:
        ex?.translationVi || `Hãy nhớ từ "${w.simplified}" (${w.meanings[0]}), rất hay dùng trong giao tiếp.`
    };
  });

  const grammarPoints = words.slice(0, 3).map((w) => {
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
    questionHanzi: `请你用“${w.simplified}”造一个句子，或者朗读包含“${w.simplified}”的例句。`,
    questionPinyin: `Qǐng nǐ yòng "${w.pinyin}" zào yī gè jùzi.`,
    questionVi: `Hãy đặt 1 câu dùng từ "${w.simplified}" (${w.meanings[0]}) để khắc sâu trí nhớ.`,
    sampleAnswerHanzi: lines[idx]?.hanzi || `我会使用${w.simplified}。`,
    sampleAnswerPinyin: lines[idx]?.pinyin || w.pinyin,
    sampleAnswerVi: lines[idx]?.translationVi || w.meanings[0]
  }));

  return {
    title: `${topicLabel} (${words.length} từ · HSK ${level})`,
    content: {
      topic: topicLabel,
      summaryVi: `Bài luyện tập tổng hợp tự động Offline cho ${words.length} từ bạn đã chọn. Kết nối mạng & nhập Gemini API Key để AI dệt thành đoạn hội thoại hoàn toàn mới!`,
      lines,
      grammarPoints,
      questions
    }
  };
}

interface UnifiedLessonCard {
  id: string;
  title: string;
  level: number;
  category: string;
  summaryVi: string;
  targetWords: string[];
  sourceType: LessonItem['sourceType'];
  date?: string;
  curated?: CuratedLesson;
  savedItem?: LessonItem;
}

export const DailyLessonPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    settings,
    updateSettings,
    isOnline,
    pushToast,
    setActiveArcadeLessonId,
    setActiveArcadeCustomWordIds,
    openSplitWord
  } = useAppStore();

  const [homeTab, setHomeTab] = useState<'lessons' | 'forgotten'>('lessons');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [savedLessons, setSavedLessons] = useState<LessonItem[]>([]);

  // Bài khóa đang mở để đọc/học
  const [activeLesson, setActiveLesson] = useState<LessonItem | null>(null);
  const [activeContent, setActiveContent] = useState<LessonContent | null>(null);
  const [activeTargetEntries, setActiveTargetEntries] = useState<DictionaryEntry[]>([]);

  // Tạo bài khóa AI theo chủ đề tự nhập
  const [customTopic, setCustomTopic] = useState('');
  const [generating, setGenerating] = useState(false);

  // Trả lời đọc hiểu + Mic 1 chạm
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [recordingQId, setRecordingQId] = useState<string | null>(null);
  const [voiceSession, setVoiceSession] = useState<ActiveRecordingSession | null>(null);

  // Mục Từ quên theo mức độ
  const [forgottenList, setForgottenList] = useState<ForgottenWordEntry[]>([]);
  const [forgottenFilterLevel, setForgottenFilterLevel] = useState<number>(0); // 0 = Tất cả
  const [selectedForgottenIds, setSelectedForgottenIds] = useState<Set<string>>(new Set());
  const [creatingFromForgotten, setCreatingFromForgotten] = useState(false);
  const [forgottenWordSet, setForgottenWordSet] = useState<Set<string>>(new Set());

  const today = getTodayDateString();
  const activeLevel = settings.targetHskLevel || 1;
  const maxLevels = settings.hskStandard === 'hsk3' ? 9 : 6;
  const effectiveCuratedLevel = Math.min(6, Math.max(1, activeLevel));

  const refreshSavedLessons = async () => {
    const all = await db.lessons.orderBy('createdAt').reverse().limit(60).toArray();
    setSavedLessons(all);
  };

  const refreshForgotten = async () => {
    const items = await getForgottenWordsWithEntries(settings.hskStandard);
    setForgottenList(items);
    setForgottenWordSet(new Set(items.map((x) => x.entry.id)));
  };

  useEffect(() => {
    refreshSavedLessons();
    refreshForgotten();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.hskStandard, activeLesson]);

  // Danh sách bài khóa hiển thị theo cấp độ hiện tại & chủ đề
  const lessonCards = useMemo<UnifiedLessonCard[]>(() => {
    const curatedForLevel: UnifiedLessonCard[] = CURATED_LESSONS.filter(
      (c) => c.level === effectiveCuratedLevel
    ).map((c) => ({
      id: c.id,
      title: c.title,
      level: c.level,
      category: c.category,
      summaryVi: c.content.summaryVi,
      targetWords: c.targetWords,
      sourceType: 'curated',
      curated: c
    }));

    const customForLevel: UnifiedLessonCard[] = savedLessons
      .filter(
        (l) =>
          l.sourceType !== 'curated' &&
          (l.level === activeLevel ||
            l.sourceType === 'forgotten-ai' ||
            l.sourceType === 'forgotten-offline' ||
            l.sourceType === 'document')
      )
      .map((l) => {
        let parsed: LessonContent | null = null;
        try {
          parsed = JSON.parse(l.contentJson) as LessonContent;
        } catch {
          parsed = null;
        }
        return {
          id: l.id,
          title: l.title,
          level: l.level,
          category:
            l.sourceType === 'forgotten-ai' || l.sourceType === 'forgotten-offline'
              ? 'Bài từ Từ quên'
              : 'Bài tự tạo (AI)',
          summaryVi: parsed?.summaryVi || 'Bài khóa cá nhân hóa lưu cục bộ trong máy.',
          targetWords: l.targetWords || [],
          sourceType: l.sourceType,
          date: l.date,
          savedItem: l
        };
      });

    const combined = [...customForLevel, ...curatedForLevel];
    if (selectedCategory === 'Tất cả') return combined;
    if (selectedCategory === 'Bài tự tạo / Từ quên') {
      return combined.filter((c) => c.sourceType !== 'curated');
    }
    return combined.filter((c) => c.category === selectedCategory);
  }, [effectiveCuratedLevel, activeLevel, savedLessons, selectedCategory]);

  const openLessonCard = async (card: UnifiedLessonCard) => {
    let item: LessonItem;
    let content: LessonContent;

    if (card.savedItem) {
      item = card.savedItem;
      content = JSON.parse(item.contentJson) as LessonContent;
    } else if (card.curated) {
      // Kiểm tra xem đã có lưu trạng thái trả lời của bài dựng sẵn này chưa
      const existing = await db.lessons.get(card.curated.id);
      if (existing) {
        item = existing;
        content = JSON.parse(existing.contentJson) as LessonContent;
      } else {
        item = {
          id: card.curated.id,
          date: today,
          title: card.curated.title,
          level: card.curated.level,
          contentJson: JSON.stringify(card.curated.content),
          targetWords: card.curated.targetWords,
          sourceType: 'curated',
          completed: false,
          createdAt: Date.now()
        };
        await db.lessons.put(item);
        content = card.curated.content;
      }
    } else {
      return;
    }

    // Tìm các từ điển tương ứng cho targetWords để người dùng có thể bấm xem chi tiết / đánh dấu quên
    const matchedEntries: DictionaryEntry[] = [];
    for (const tw of item.targetWords) {
      const found = await db.dictionary.where('simplified').equals(tw).first();
      if (found) matchedEntries.push(found);
    }

    setActiveLesson(item);
    setActiveContent(content);
    setActiveTargetEntries(matchedEntries);
    setAnswers({});
  };

  const handleGenerateAiTopicLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generating) return;

    const topicText = customTopic.trim() || `Tình huống thực tế HSK ${activeLevel}`;
    setGenerating(true);
    try {
      const picked = await pickDailyTargetWords(effectiveCuratedLevel, settings.dailyWordGoal || 10);
      const wordStrings = picked.words.map((w) => w.simplified);

      if (isOnline && settings.geminiApiKey.trim()) {
        const aiRes = await generateDailyLessonAI(
          today,
          activeLevel,
          wordStrings,
          topicText,
          true
        );
        const newLesson: LessonItem = {
          id: createId('lesson_ai'),
          date: today,
          title: aiRes.title,
          level: activeLevel,
          contentJson: JSON.stringify(aiRes.content),
          targetWords: wordStrings,
          sourceType: 'daily-ai',
          completed: false,
          createdAt: Date.now()
        };
        await db.lessons.put(newLesson);
        await refreshSavedLessons();
        setCustomTopic('');
        pushToast('Đã tạo bài khóa AI mới & lưu vĩnh viễn offline!', 'success');
        await openLessonCard({
          id: newLesson.id,
          title: newLesson.title,
          level: newLesson.level,
          category: 'Bài tự tạo (AI)',
          summaryVi: aiRes.content.summaryVi,
          targetWords: wordStrings,
          sourceType: 'daily-ai',
          savedItem: newLesson
        });
      } else {
        const off = buildOfflineCustomLesson(picked.words, activeLevel, topicText);
        const newLesson: LessonItem = {
          id: createId('lesson_off'),
          date: today,
          title: off.title,
          level: activeLevel,
          contentJson: JSON.stringify(off.content),
          targetWords: wordStrings,
          sourceType: 'daily-offline',
          completed: false,
          createdAt: Date.now()
        };
        await db.lessons.put(newLesson);
        await refreshSavedLessons();
        setCustomTopic('');
        pushToast(
          'Đang Offline hoặc chưa có API Key → đã tạo bài luyện từ kho câu mẫu Offline!',
          'info'
        );
        await openLessonCard({
          id: newLesson.id,
          title: newLesson.title,
          level: newLesson.level,
          category: 'Bài tự tạo (AI)',
          summaryVi: off.content.summaryVi,
          targetWords: wordStrings,
          sourceType: 'daily-offline',
          savedItem: newLesson
        });
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi tạo bài khóa AI', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Tạo bài khóa trực tiếp từ các TỪ QUÊN đã chọn!
  const handleCreateLessonFromForgotten = async () => {
    const selectedEntries = forgottenList
      .filter((item) => selectedForgottenIds.has(item.entry.id))
      .map((item) => item.entry);

    if (selectedEntries.length === 0) {
      pushToast('Hãy tick chọn ít nhất 1 từ quên để tạo bài khóa.', 'warning');
      return;
    }

    setCreatingFromForgotten(true);
    try {
      const targetWords = selectedEntries.slice(0, 15).map((e) => e.simplified);
      const levelForLesson =
        forgottenFilterLevel > 0
          ? forgottenFilterLevel
          : selectedEntries[0].hskLevel || activeLevel;
      const topicPrompt = `Bài khóa ôn tập chuyên sâu các từ hay quên (${targetWords.join('、')})`;

      let title = '';
      let content: LessonContent;
      let sourceType: LessonItem['sourceType'] = 'forgotten-offline';

      if (isOnline && settings.geminiApiKey.trim()) {
        try {
          const aiRes = await generateDailyLessonAI(
            today,
            levelForLesson,
            targetWords,
            topicPrompt,
            true
          );
          title = aiRes.title;
          content = aiRes.content;
          sourceType = 'forgotten-ai';
        } catch (err) {
          pushToast(
            `${err instanceof Error ? err.message : 'AI tạm bận'} → Chuyển sang tạo bài khóa Offline ngay!`,
            'warning'
          );
          const off = buildOfflineCustomLesson(
            selectedEntries,
            levelForLesson,
            'Bài ôn Từ quên đã chọn'
          );
          title = off.title;
          content = off.content;
        }
      } else {
        const off = buildOfflineCustomLesson(
          selectedEntries,
          levelForLesson,
          'Bài ôn Từ quên đã chọn'
        );
        title = off.title;
        content = off.content;
      }

      const newLesson: LessonItem = {
        id: createId('lesson_fgt'),
        date: today,
        title,
        level: levelForLesson,
        contentJson: JSON.stringify(content),
        targetWords,
        sourceType,
        completed: false,
        createdAt: Date.now()
      };
      await db.lessons.put(newLesson);
      await refreshSavedLessons();
      setSelectedForgottenIds(new Set());
      setHomeTab('lessons');
      pushToast(`Đã tạo bài khóa từ ${targetWords.length} từ quên!`, 'success');

      await openLessonCard({
        id: newLesson.id,
        title: newLesson.title,
        level: newLesson.level,
        category: 'Bài từ Từ quên',
        summaryVi: content.summaryVi,
        targetWords,
        sourceType,
        savedItem: newLesson
      });
    } finally {
      setCreatingFromForgotten(false);
    }
  };

  const handlePlayArcadeWithForgotten = () => {
    const ids = Array.from(selectedForgottenIds);
    if (ids.length === 0) {
      pushToast('Hãy chọn ít nhất 1 từ quên để luyện chơi.', 'warning');
      return;
    }
    setActiveArcadeCustomWordIds(ids);
    navigate('/arcade');
  };

  const handleDeleteSavedLesson = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.lessons.delete(id);
    await refreshSavedLessons();
    pushToast('Đã xóa bài khóa tự tạo.', 'info');
  };

  const handleToggleTargetWordForgotten = async (entry: DictionaryEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !forgottenWordSet.has(entry.id);
    await markWordForgotten(entry.id, entry.simplified, nextVal, 'forgotten');
    await refreshForgotten();
    pushToast(
      nextVal
        ? `Đã thêm "${entry.simplified}" vào mục Từ quên!`
        : `Đã gỡ "${entry.simplified}" khỏi Từ quên.`,
      nextVal ? 'warning' : 'success'
    );
  };

  const handleGradeQuestion = async (qId: string) => {
    if (!activeLesson || !activeContent) return;
    const q = activeContent.questions.find((item) => item.id === qId);
    const userAns = (answers[qId] || '').trim();
    if (!q || !userAns) return;

    setGradingId(qId);
    try {
      const passage = activeContent.lines.map((l) => l.hanzi).join('\n');
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

      const updatedQuestions = activeContent.questions.map((item) =>
        item.id === qId ? { ...item, userAnswer: userAns, aiFeedback: feedback } : item
      );
      const nextContent = { ...activeContent, questions: updatedQuestions };
      setActiveContent(nextContent);
      await db.lessons.update(activeLesson.id, { contentJson: JSON.stringify(nextContent) });
      await recordStudyActivity({ expEarned: feedback.isCorrect ? 15 : 5 });
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi chấm câu trả lời', 'error');
    } finally {
      setGradingId(null);
    }
  };

  // Mic 1 chạm BẬT — 1 chạm TẮT
  const handleVoiceAnswer = async (qId: string) => {
    if (recordingQId === qId && voiceSession) {
      setRecordingQId(null);
      const sess = voiceSession;
      setVoiceSession(null);
      const res = await sess.stopAndTranscribe();
      if (res.transcript) {
        setAnswers((prev) => ({ ...prev, [qId]: res.transcript }));
      } else {
        pushToast('Chưa thu được giọng nói. Hãy bấm Mic nói lại hoặc gõ trực tiếp.', 'info');
      }
      return;
    }
    if (voiceSession) {
      voiceSession.cancel();
      setVoiceSession(null);
      setRecordingQId(null);
    }
    try {
      const sess = await startChineseSpeechSession({
        lang: 'zh-CN',
        onInterim: (live) => {
          if (live) setAnswers((prev) => ({ ...prev, [qId]: live }));
        }
      });
      setVoiceSession(sess);
      setRecordingQId(qId);
      pushToast('🎙️ Đang bật Mic (Tiếng Trung) — nói xong bấm lại nút Mic để tắt.', 'info');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Không bật được Micro', 'warning');
    }
  };

  // Nhóm danh sách từ quên theo cấp độ HSK
  const filteredForgotten = useMemo(() => {
    if (forgottenFilterLevel === 0) return forgottenList;
    if (forgottenFilterLevel === -1) return forgottenList.filter((x) => x.effectiveLevel === 0);
    return forgottenList.filter((x) => x.effectiveLevel === forgottenFilterLevel);
  }, [forgottenList, forgottenFilterLevel]);

  const forgottenGroupedByLevel = useMemo(() => {
    const map = new Map<number, ForgottenWordEntry[]>();
    for (const item of filteredForgotten) {
      const arr = map.get(item.effectiveLevel) || [];
      arr.push(item);
      map.set(item.effectiveLevel, arr);
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === 0) return 1;
      if (b[0] === 0) return -1;
      return a[0] - b[0];
    });
  }, [filteredForgotten]);

  const forgottenCountByLevel = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of forgottenList) {
      counts.set(item.effectiveLevel, (counts.get(item.effectiveLevel) || 0) + 1);
    }
    return counts;
  }, [forgottenList]);

  // ==================== VIEW 2: CHI TIẾT BÀI KHÓA ĐANG HỌC ====================
  if (activeLesson && activeContent) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (voiceSession) {
                voiceSession.cancel();
                setVoiceSession(null);
                setRecordingQId(null);
              }
              setActiveLesson(null);
              setActiveContent(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Chọn bài khóa &amp; chủ đề khác</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveArcadeLessonId(activeLesson.id);
              navigate('/arcade');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition active:scale-95"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Chơi Game ôn bài này</span>
          </button>
        </div>

        {/* Header bài khóa */}
        <div className="rounded-2xl bg-gradient-to-r from-brand-600 via-rose-600 to-amber-600 text-white p-5 shadow-md space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20">
              HSK {activeLesson.level}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-black/20">
              {activeContent.topic}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold leading-snug">{activeLesson.title}</h1>
          <p className="text-xs sm:text-sm text-rose-100 max-w-2xl">{activeContent.summaryVi}</p>
        </div>

        <DisplayControlBar />

        {/* Từ vựng trọng tâm của bài (bấm để tra / bấm cờ để thêm Từ quên) */}
        {activeTargetEntries.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Từ vựng trọng tâm trong bài ({activeTargetEntries.length} từ)</span>
              </h2>
              <span className="text-[11px] text-slate-400">
                Bấm biểu tượng cờ 🚩 để đưa từ chưa nhớ vào mục Từ quên
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {activeTargetEntries.map((w) => {
                const isFgt = forgottenWordSet.has(w.id);
                return (
                  <div
                    key={w.id}
                    onClick={() => {
                      if (window.innerWidth >= 1024) openSplitWord(w.id, 'word');
                      else navigate(`/dictionary?word=${encodeURIComponent(w.id)}`);
                    }}
                    className="cursor-pointer group rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:border-brand-500 px-3 py-1.5 text-left transition flex items-center gap-2"
                  >
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-hanzi text-base font-bold text-slate-900 dark:text-white group-hover:text-brand-600">
                          {w.simplified}
                        </span>
                        <PeekableText
                          kind="pinyin"
                          inline
                          className="text-[11px] text-brand-600 font-semibold"
                        >
                          {w.pinyin}
                        </PeekableText>
                      </div>
                      <PeekableText
                        kind="meaning"
                        className="text-[11px] text-slate-500 line-clamp-1 max-w-[140px]"
                      >
                        {w.meanings[0]}
                      </PeekableText>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleToggleTargetWordForgotten(w, e)}
                      className={`p-1 rounded-lg transition ${
                        isFgt
                          ? 'bg-amber-500 text-white'
                          : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                      }`}
                      title={isFgt ? 'Đã trong Từ quên (bấm bỏ)' : 'Thêm vào Từ quên'}
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Nội dung Bài khóa / Hội thoại */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-base font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-brand-600" />
              <span>Nội dung Bài khóa (Chạm chữ bất kỳ để tra &amp; thêm Từ quên)</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                const text = activeContent.lines.map((l) => l.hanzi).join('。');
                speakChinese(text).catch(() => {});
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 px-3 py-1.5 text-xs font-bold hover:bg-brand-100"
            >
              <Volume2 className="w-4 h-4" />
              <span>Nghe toàn bài</span>
            </button>
          </div>

          <div className="space-y-3">
            {activeContent.lines.map((line, idx) => (
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
                    highlightWords={activeLesson.targetWords}
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
          {activeContent.grammarPoints.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Ngữ pháp trọng tâm trong bài
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeContent.grammarPoints.map((gp, i) => (
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

        {/* Câu hỏi Đọc hiểu */}
        {activeContent.questions.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold">
              Trả lời câu hỏi đọc hiểu ({activeContent.questions.length} câu)
            </h2>
            <div className="space-y-4">
              {activeContent.questions.map((q, idx) => (
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
                      placeholder="Gõ hoặc bấm Mic (1 lần bật, 1 lần tắt) trả lời tiếng Trung..."
                      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-hanzi text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleVoiceAnswer(q.id)}
                      className={`px-3 py-2 rounded-xl border inline-flex items-center gap-1 text-xs font-bold transition ${
                        recordingQId === q.id
                          ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title={
                        recordingQId === q.id
                          ? 'Bấm lần 2 để tắt Mic'
                          : 'Bấm lần 1 để bật Mic nói tiếng Trung'
                      }
                    >
                      {recordingQId === q.id ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Tắt Mic</span>
                        </>
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
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
  }

  // ==================== VIEW 1: TRANG CHÍNH CHỌN BÀI KHÓA & TỪ QUÊN ====================
  return (
    <div className="space-y-5">
      {/* Header + 2 Tab chính: Bài khóa theo Trình độ/Chủ đề & Từ quên theo mức độ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-brand-600" />
            <span>Học hôm nay — Bài khóa &amp; Từ quên</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Chọn trình độ và chủ đề bạn muốn học ngay (100% có sẵn offline) hoặc tạo bài khóa riêng từ danh sách Từ quên.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          <button
            type="button"
            onClick={() => setHomeTab('lessons')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              homeTab === 'lessons'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Bài khóa ({lessonCards.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setHomeTab('forgotten')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              homeTab === 'forgotten'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Flag className="w-4 h-4" />
            <span>Từ quên ({forgottenList.length})</span>
          </button>
        </div>
      </div>

      {/* ===== TAB A: CHỌN BÀI KHÓA THEO TRÌNH ĐỘ & CHỦ ĐỀ ===== */}
      {homeTab === 'lessons' && (
        <div className="space-y-4">
          {/* Bộ chọn Trình độ (đồng bộ toàn ứng dụng với Cài đặt) & Chủ đề */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3.5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  1. Chọn trình độ ({settings.hskStandard === 'hsk3' ? 'HSK 3.0' : 'HSK 1–6'} · Đồng bộ Cài đặt &amp; Trò chơi)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: maxLevels }, (_, i) => i + 1).map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => updateSettings({ targetHskLevel: lv })}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
                      activeLevel === lv
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                    }`}
                  >
                    HSK {lv}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Lọc theo chủ đề bài khóa
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['Tất cả', ...LESSON_TOPIC_CATEGORIES, 'Bài tự tạo / Từ quên'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      selectedCategory === cat
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Thanh tạo bài khóa mới theo chủ đề tự nhập bằng AI (hoặc Offline) */}
            <form
              onSubmit={handleGenerateAiTopicLesson}
              className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder={`Nhập chủ đề bất kỳ để tạo thêm bài khóa HSK ${activeLevel} (VD: Đi siêu thị, Xin nghỉ phép, Đặt vé tàu)...`}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={generating}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-rose-600 hover:opacity-95 text-white px-4 py-2.5 text-xs font-bold shadow-sm disabled:opacity-50 shrink-0"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>
                  {generating
                    ? 'Đang tạo bài...'
                    : isOnline && settings.geminiApiKey.trim()
                      ? 'Tạo bài khóa mới (AI)'
                      : 'Tạo bài khóa nhanh (Offline)'}
                </span>
              </button>
            </form>
          </div>

          {/* Lưới các bài khóa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {lessonCards.map((card) => (
              <div
                key={card.id}
                onClick={() => openLessonCard(card)}
                className="cursor-pointer group rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-400 dark:hover:border-brand-600 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                        HSK {card.level}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {card.category}
                      </span>
                      {card.sourceType === 'curated' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Sẵn Offline
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                          {card.sourceType.includes('forgotten') ? 'Từ quên' : 'Tự tạo'}
                        </span>
                      )}
                    </div>
                    {card.sourceType !== 'curated' && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSavedLesson(card.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Xóa bài tự tạo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-brand-600 transition">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {card.summaryVi}
                  </p>
                </div>

                {card.targetWords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {card.targetWords.slice(0, 7).map((w, i) => (
                      <span
                        key={`${w}-${i}`}
                        className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-hanzi text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        {w}
                      </span>
                    ))}
                    {card.targetWords.length > 7 && (
                      <span className="text-[11px] text-slate-400 self-center">
                        +{card.targetWords.length - 7} từ
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {lessonCards.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 space-y-2">
              <p>Chưa có bài khóa nào trong mục lọc "{selectedCategory}" ở cấp HSK {activeLevel}.</p>
              <button
                type="button"
                onClick={() => setSelectedCategory('Tất cả')}
                className="text-xs font-bold text-brand-600 hover:underline"
              >
                Xem tất cả chủ đề HSK {activeLevel}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB B: TỪ QUÊN THEO MỨC ĐỘ & TẠO BÀI KHÓA TỪ TỪ QUÊN ===== */}
      {homeTab === 'forgotten' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Flag className="w-5 h-5 text-amber-500" />
                  <span>Danh sách Từ quên theo mức độ ({forgottenList.length} từ)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tự động gom khi bạn trả lời sai trong trò chơi hoặc bấm nút <strong>"+ Từ quên"</strong> ở Từ điển &amp; Bài khóa. Tick chọn các từ bên dưới để tạo bài khóa ôn riêng!
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dictionary')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 px-3 py-2 text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm từ từ Từ điển</span>
              </button>
            </div>

            {/* Lọc theo cấp độ HSK */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setForgottenFilterLevel(0)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                  forgottenFilterLevel === 0
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                Tất cả ({forgottenList.length})
              </button>
              {Array.from({ length: maxLevels }, (_, i) => i + 1).map((lv) => {
                const cnt = forgottenCountByLevel.get(lv) || 0;
                return (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setForgottenFilterLevel(lv)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                      forgottenFilterLevel === lv
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    HSK {lv} ({cnt})
                  </button>
                );
              })}
              {(forgottenCountByLevel.get(0) || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setForgottenFilterLevel(-1)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                    forgottenFilterLevel === -1
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Mở rộng ({forgottenCountByLevel.get(0)})
                </button>
              )}
            </div>

            {/* Thanh hành động chọn từ tạo bài khóa / chơi game */}
            {filteredForgotten.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedForgottenIds.size === filteredForgotten.length) {
                      setSelectedForgottenIds(new Set());
                    } else {
                      setSelectedForgottenIds(
                        new Set(filteredForgotten.slice(0, 15).map((x) => x.entry.id))
                      );
                    }
                  }}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {selectedForgottenIds.size === filteredForgotten.length
                    ? 'Bỏ chọn tất cả'
                    : `Chọn nhanh (${Math.min(15, filteredForgotten.length)} từ)`}
                </button>

                <button
                  type="button"
                  disabled={selectedForgottenIds.size === 0 || creatingFromForgotten}
                  onClick={handleCreateLessonFromForgotten}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-xs font-bold shadow-sm disabled:opacity-40"
                >
                  {creatingFromForgotten ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    Tạo bài khóa từ {selectedForgottenIds.size} từ đã chọn
                  </span>
                </button>

                <button
                  type="button"
                  disabled={selectedForgottenIds.size === 0}
                  onClick={handlePlayArcadeWithForgotten}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-xs font-bold shadow-sm disabled:opacity-40"
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span>Chơi Game ({selectedForgottenIds.size} từ)</span>
                </button>
              </div>
            )}
          </div>

          <DisplayControlBar compact />

          {forgottenGroupedByLevel.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-3">
              <Flag className="w-10 h-10 mx-auto text-amber-400" />
              <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Chưa có từ quên nào ở mức độ này
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Khi học bài khóa, tra Từ điển hoặc chơi Trò chơi, bấm nút <strong>"+ Từ quên"</strong> (hoặc khi trả lời sai) từ đó sẽ tự hiện tại đây để bạn chọn tạo thành bài khóa ôn tập riêng!
              </p>
              <button
                type="button"
                onClick={() => navigate('/dictionary')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 text-white px-4 py-2 text-xs font-bold"
              >
                <Plus className="w-4 h-4" /> Mở Từ điển để đánh dấu từ quên
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {forgottenGroupedByLevel.map(([lv, items]) => (
                <div
                  key={lv}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-amber-700 dark:text-amber-400">
                      {lv > 0 ? `Cấp độ HSK ${lv}` : 'Từ vựng mở rộng ngoài HSK'} ({items.length} từ)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map(({ vocab, entry }) => {
                      const checked = selectedForgottenIds.has(entry.id);
                      return (
                        <div
                          key={entry.id}
                          onClick={() => {
                            setSelectedForgottenIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(entry.id)) next.delete(entry.id);
                              else next.add(entry.id);
                              return next;
                            });
                          }}
                          className={`cursor-pointer rounded-xl border p-3 transition flex items-start justify-between gap-2 ${
                            checked
                              ? 'bg-brand-50/80 dark:bg-brand-950/40 border-brand-500 shadow-sm'
                              : 'bg-slate-50/70 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span
                              className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                                checked
                                  ? 'bg-brand-600 border-brand-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                              }`}
                            >
                              {checked && <Check className="w-3.5 h-3.5" />}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="font-hanzi text-xl font-bold text-slate-900 dark:text-white">
                                  {entry.simplified}
                                </span>
                                <PeekableText
                                  kind="pinyin"
                                  inline
                                  className="text-xs font-semibold text-brand-600"
                                >
                                  {entry.pinyin}
                                </PeekableText>
                                {vocab.wrongCount > 0 && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                    Sai {vocab.wrongCount} lần
                                  </span>
                                )}
                              </div>
                              <PeekableText
                                kind="meaning"
                                className="text-xs text-slate-600 dark:text-slate-300 mt-0.5"
                              >
                                {entry.meanings.join('; ')}
                              </PeekableText>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                speakChinese(entry.simplified).catch(() => {});
                              }}
                              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-brand-600"
                              title="Nghe phát âm"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await markWordForgotten(entry.id, entry.simplified, false);
                                setSelectedForgottenIds((prev) => {
                                  const next = new Set(prev);
                                  next.delete(entry.id);
                                  return next;
                                });
                                await refreshForgotten();
                                pushToast(`Tuyệt vời! Đã bỏ "${entry.simplified}" khỏi Từ quên.`, 'success');
                              }}
                              className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-[11px] font-bold"
                              title="Đánh dấu đã nhớ (gỡ khỏi danh sách từ quên)"
                            >
                              Đã nhớ
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
