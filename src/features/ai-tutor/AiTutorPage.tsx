import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  GraduationCap,
  ImagePlus,
  Lightbulb,
  Loader2,
  MessageSquare,
  Mic,
  PenLine,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  X
} from 'lucide-react';
import { getSetting, setSetting } from '@/db/database';
import { streamGeminiChat } from '@/services/ai/geminiClient';
import {
  gradeSentenceCreationAI,
  roleplayChatAI,
  type RoleplayAiReply,
  type SentenceDrillGrade
} from '@/services/ai/aiTasks';
import { speakChinese } from '@/services/tts/ttsService';
import {
  startChineseSpeechSession,
  type ActiveRecordingSession,
  type SpeechLang
} from '@/services/stt/sttService';
import {
  pickDailyTargetWords,
  Rating,
  recordStudyActivity,
  recordVocabReview
} from '@/services/fsrs/fsrsService';
import { useAppStore } from '@/stores/useAppStore';
import type { DictionaryEntry } from '@/types';
import { containsHanzi } from '@/utils/pinyin';
import { DisplayControlBar } from '@/components/common/DisplayControlBar';
import { InteractiveHanziText } from '@/components/common/InteractiveHanziText';

interface FreeTutorMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  imagePreview?: string;
  modelUsed?: string;
}

interface RoleplayMessage {
  id: string;
  role: 'user' | 'assistant';
  hanzi: string;
  pinyin?: string;
  translationVi?: string;
  tutorFeedback?: RoleplayAiReply['tutorFeedback'];
}

const SCENARIOS = [
  { id: 'daily-words', label: '🎯 Gài tự động từ chưa thuộc hôm nay' },
  { id: 'restaurant', label: '🍜 Quán ăn & gọi món' },
  { id: 'shopping', label: '🛍️ Mua sắm & mặc cả' },
  { id: 'travel', label: '✈️ Du lịch, hỏi đường & đặt phòng' },
  { id: 'interview', label: '💼 Phỏng vấn xin việc tiếng Trung' },
  { id: 'free', label: '💬 Trò chuyện tự do đời sống' }
];

const QUICK_PROMPTS = [
  'Kiểm tra giúp tôi câu tiếng Trung này sai ở đâu và sửa lại cho tự nhiên: 我昨天去了吃饭。',
  'Phân biệt giúp tôi cách dùng 了 (le) và 过 (guò) kèm ví dụ dễ hiểu.',
  'Cho tôi 3 câu bài tập dịch Việt → Trung trình độ hiện tại để tôi tự làm rồi bạn chấm lỗi.',
  '你好！我想用中文和你聊天，如果我哪里说错了请告诉我。'
];

function buildFreeTutorSystemPrompt(level: number, standard: 'hsk2' | 'hsk3'): string {
  const stdLabel = standard === 'hsk3' ? `HSK 3.0 cấp ${level}` : `HSK ${level}`;
  return (
    `Bạn là Gia sư tiếng Trung Giản thể 1-1 cực kỳ tận tâm, thông minh và phản hồi nhanh cho người Việt (trình độ hiện tại của học viên: ${stdLabel}).\n` +
    `NGUYÊN TẮC BẮT BUỘC:\n` +
    `1. Giao tiếp LINH HOẠT theo đúng yêu cầu của học viên — học viên hỏi/nhắn bằng tiếng Việt, tiếng Trung hay song ngữ đều đáp lại tự nhiên, không ép vào kịch bản cứng nhắc.\n` +
    `2. Khi học viên gửi câu tiếng Trung, bài tập, bài dịch hoặc ảnh chụp đề bài:\n` +
    `   - Chỉ rõ **Đúng hay Sai**.\n` +
    `   - Nêu rõ **Sai ở chỗ nào** và **Vì sao sai** (ngữ pháp, trật tự từ, lượng từ, dùng từ, thanh điệu...).\n` +
    `   - Đưa ra **Bản sửa chuẩn tự nhiên nhất** kèm đầy đủ **Pinyin có dấu** và **Nghĩa tiếng Việt**.\n` +
    `3. Khi học viên nhờ giảng bài, phân biệt từ, dịch thuật hoặc ra đề luyện tập: trình bày súc tích, rõ ý, gạch đầu dòng dễ đọc, luôn kèm chữ Hán Giản thể + Pinyin chuẩn dấu thanh + ví dụ thực tế.\n` +
    `4. Nếu học viên nhắn hoàn toàn bằng tiếng Trung để luyện hội thoại: trả lời bằng tiếng Trung (kèm Pinyin + dịch ngắn tiếng Việt bên dưới) và góp ý nhẹ nếu câu của học viên có lỗi sai.`
  );
}

/**
 * Hiển thị nội dung tin nhắn Gia sư tự do: dòng có chữ Hán cho phép chạm Tap-to-Lookup & nghe phát âm!
 */
const RichTutorMessageBody: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;
        const clean = trimmed.replace(/\*\*/g, '');
        if (containsHanzi(clean)) {
          const hanziOnly = clean
            .replace(/[^\u4e00-\u9fff0-9，。！？；：、“”‘’（）\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          return (
            <div key={idx} className="flex items-start gap-1.5">
              <div className="flex-1 min-w-0">
                <InteractiveHanziText
                  text={clean}
                  hanziClassName="text-sm sm:text-base leading-relaxed"
                />
              </div>
              {hanziOnly.length >= 2 && (
                <button
                  type="button"
                  onClick={() => speakChinese(hanziOnly).catch(() => {})}
                  className="shrink-0 p-1 rounded-md text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/60 mt-0.5"
                  title="Nghe câu tiếng Trung này"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        }
        return (
          <p key={idx} className="whitespace-pre-wrap break-words">
            {clean}
          </p>
        );
      })}
    </div>
  );
};

export const AiTutorPage: React.FC = () => {
  const { settings, updateSettings, isOnline, pushToast } = useAppStore();
  const [activeTab, setActiveTab] = useState<'free-tutor' | 'roleplay' | 'drill'>('free-tutor');
  const [level, setLevel] = useState(settings.targetHskLevel || 2);

  // ==================== TAB 1: GIA SƯ HỎI ĐÁP & CHỮA BÀI TỰ DO (MẶC ĐỊNH) ====================
  const [freeMessages, setFreeMessages] = useState<FreeTutorMessage[]>([]);
  const [freeInput, setFreeInput] = useState('');
  const [freeLoading, setFreeLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{
    preview: string;
    base64: string;
    mimeType: string;
  } | null>(null);
  const [micLang, setMicLang] = useState<SpeechLang>('vi-VN');
  const [freeRecording, setFreeRecording] = useState(false);
  const freeVoiceRef = useRef<ActiveRecordingSession | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const freeBottomRef = useRef<HTMLDivElement | null>(null);

  // ==================== TAB 2: ROLEPLAY ====================
  const [scenario, setScenario] = useState(SCENARIOS[0].id);
  const [rpMessages, setRpMessages] = useState<RoleplayMessage[]>([]);
  const [suggestedReplies, setSuggestedReplies] = useState<
    Array<{ hanzi: string; pinyin: string; meaningVi: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [rpInput, setRpInput] = useState('');
  const [rpLoading, setRpLoading] = useState(false);
  const [dailyWords, setDailyWords] = useState<string[]>([]);
  const [rpRecording, setRpRecording] = useState(false);
  const rpVoiceRef = useRef<ActiveRecordingSession | null>(null);
  const rpBottomRef = useRef<HTMLDivElement | null>(null);

  // ==================== TAB 3: SENTENCE DRILL ====================
  const [drillWords, setDrillWords] = useState<DictionaryEntry[]>([]);
  const [drillCount, setDrillCount] = useState<1 | 2 | 3>(2);
  const [drillInput, setDrillInput] = useState('');
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillGrade, setDrillGrade] = useState<SentenceDrillGrade | null>(null);

  // Đồng bộ cấp độ từ Cài đặt
  useEffect(() => {
    setLevel(settings.targetHskLevel || 1);
  }, [settings.targetHskLevel]);

  // Khôi phục lịch sử chat Gia sư tự do từ IndexedDB
  useEffect(() => {
    getSetting<FreeTutorMessage[]>('aiTutorFreeChatHistory', []).then((saved) => {
      if (Array.isArray(saved) && saved.length > 0) {
        setFreeMessages(saved.slice(-24));
      }
    });
  }, []);

  useEffect(() => {
    if (freeMessages.length > 0) {
      // Lưu lịch sử rút gọn (không lưu ảnh base64 nặng vào settings)
      const compact = freeMessages.slice(-24).map(({ imagePreview: _img, ...rest }) => rest);
      setSetting('aiTutorFreeChatHistory', compact).catch(() => {});
    }
  }, [freeMessages]);

  useEffect(() => {
    freeBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [freeMessages, freeLoading]);

  useEffect(() => {
    rpBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rpMessages]);

  const loadDrillWords = async (count = drillCount) => {
    const picked = await pickDailyTargetWords(Math.min(6, level), 10);
    const shuffled = [...picked.words].sort(() => Math.random() - 0.5);
    setDrillWords(shuffled.slice(0, count));
    setDrillGrade(null);
    setDrillInput('');
  };

  useEffect(() => {
    pickDailyTargetWords(Math.min(6, level), settings.dailyWordGoal || 10).then((r) => {
      setDailyWords(r.words.map((w) => w.simplified));
    });
    loadDrillWords(drillCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // Cleanup khi rời trang
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
      freeVoiceRef.current?.cancel();
      rpVoiceRef.current?.cancel();
    };
  }, []);

  // --- Handlers Tab 1: Gia sư Tự do Song ngữ ---
  const handleAttachImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      setAttachedImage({
        preview: dataUrl,
        base64,
        mimeType: file.type || 'image/jpeg'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleToggleFreeMic = async () => {
    // Nhấn lần 2 -> Tắt Mic & chèn chữ đã nói
    if (freeRecording && freeVoiceRef.current) {
      setFreeRecording(false);
      const sess = freeVoiceRef.current;
      freeVoiceRef.current = null;
      try {
        const res = await sess.stopAndTranscribe();
        if (res.transcript) {
          setFreeInput((prev) => {
            const base = prev.trim();
            return base && !res.transcript.startsWith(base) ? `${base} ${res.transcript}` : res.transcript;
          });
        } else {
          pushToast('Không nghe rõ giọng nói. Bấm Mic để thử nói lại nhé!', 'info');
        }
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'Lỗi dừng ghi âm', 'warning');
      }
      return;
    }

    // Nhấn lần 1 -> Bật Mic chờ người dùng nói
    try {
      const prefix = freeInput.trim();
      freeVoiceRef.current = await startChineseSpeechSession({
        lang: micLang,
        onInterim: (liveText) => {
          if (liveText) {
            setFreeInput(prefix ? `${prefix} ${liveText}` : liveText);
          }
        }
      });
      setFreeRecording(true);
      pushToast(
        micLang === 'vi-VN'
          ? '🎙️ Mic đang BẬT (Tiếng Việt) — nói xong bấm lại nút Mic để tắt.'
          : '🎙️ Mic đang BẬT (Tiếng Trung) — nói xong bấm lại nút Mic để tắt.',
        'info'
      );
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Không bật được Micro', 'warning');
    }
  };

  const handleSendFreeTutor = async (overrideText?: string) => {
    const text = (overrideText ?? freeInput).trim();
    if ((!text && !attachedImage) || freeLoading) return;

    // Nếu đang bật mic mà người dùng bấm Gửi luôn -> dừng mic gọn gàng
    if (freeRecording && freeVoiceRef.current) {
      freeVoiceRef.current.cancel();
      freeVoiceRef.current = null;
      setFreeRecording(false);
    }

    const promptText = text || 'Hãy xem ảnh bài tập này, giải thích rõ ràng và kiểm tra xem có lỗi sai nào không giúp tôi.';
    const currentImg = attachedImage;
    setFreeInput('');
    setAttachedImage(null);

    const userMsg: FreeTutorMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: promptText,
      imagePreview: currentImg?.preview
    };
    const aiMsgId = `ai_${Date.now() + 1}`;

    const historyBefore = [...freeMessages];
    setFreeMessages((prev) => [
      ...prev,
      userMsg,
      { id: aiMsgId, role: 'model', text: '' }
    ]);
    setFreeLoading(true);

    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const res = await streamGeminiChat({
        systemInstruction: buildFreeTutorSystemPrompt(level, settings.hskStandard),
        history: historyBefore.map((m) => ({ role: m.role, text: m.text })),
        userMessage: promptText,
        userParts: currentImg
          ? [{ inlineData: { mimeType: currentImg.mimeType, data: currentImg.base64 } }]
          : undefined,
        tier: 'primary',
        signal: controller.signal,
        onChunk: (fullText) => {
          setFreeMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, text: fullText } : m))
          );
        }
      });

      setFreeMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, text: res.text, modelUsed: res.modelUsed } : m
        )
      );
      await recordStudyActivity({ expEarned: 8 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối Gia sư AI';
      setFreeMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId && !m.text
            ? {
                ...m,
                text: `⚠️ ${msg}\n\nMẹo: Kiểm tra chấm xanh Online ở góc trên và bấm "Kiểm tra kết nối" trong mục Cài đặt.`
              }
            : m
        )
      );
      pushToast(msg, 'error');
    } finally {
      streamAbortRef.current = null;
      setFreeLoading(false);
    }
  };

  const handleStopStream = () => {
    streamAbortRef.current?.abort();
  };

  const handleClearFreeChat = async () => {
    streamAbortRef.current?.abort();
    setFreeMessages([]);
    await setSetting('aiTutorFreeChatHistory', []);
    pushToast('Đã mở cuộc trò chuyện mới với Gia sư AI.', 'info');
  };

  // --- Handlers Tab 2: Roleplay ---
  const startNewRoleplay = async (selectedScenario = scenario) => {
    const meta = SCENARIOS.find((s) => s.id === selectedScenario) || SCENARIOS[0];
    setRpMessages([]);
    setSuggestedReplies([]);
    setShowSuggestions(false);

    if (!isOnline || !settings.geminiApiKey.trim()) {
      setRpMessages([
        {
          id: 'welcome_off',
          role: 'assistant',
          hanzi: '你好！欢迎来到口语练习室。我们今天想聊什么话题？',
          pinyin: 'Nǐ hǎo! Huānyíng láidào kǒuyǔ liànxíshì. Wǒmen jīntiān xiǎng liáo shénme huàtí?',
          translationVi:
            'Xin chào! (Hãy kết nối mạng & nhập Gemini API Key miễn phí trong Cài đặt để đóng vai tương tác cùng AI!)'
        }
      ]);
      return;
    }

    setRpLoading(true);
    try {
      const reply = await roleplayChatAI({
        scenario: meta.label,
        level,
        targetWords: selectedScenario === 'daily-words' ? dailyWords : undefined,
        history: [],
        userMessage: 'Hãy mở lời chào tự nhiên vào tình huống đóng vai bằng 1-2 câu tiếng Trung.'
      });
      setRpMessages([
        {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          hanzi: reply.replyHanzi,
          pinyin: reply.replyPinyin,
          translationVi: reply.replyVi
        }
      ]);
      setSuggestedReplies(reply.suggestedReplies);
      speakChinese(reply.replyHanzi, { silentError: true }).catch(() => {});
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi kết nối Gia sư AI', 'error');
    } finally {
      setRpLoading(false);
    }
  };

  const handleSendRoleplay = async (textToSend?: string) => {
    const text = (textToSend ?? rpInput).trim();
    if (!text || rpLoading) return;
    setRpInput('');
    setShowSuggestions(false);

    const userMsg: RoleplayMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      hanzi: text
    };
    const nextHistory = [...rpMessages, userMsg];
    setRpMessages(nextHistory);
    setRpLoading(true);

    try {
      const meta = SCENARIOS.find((s) => s.id === scenario) || SCENARIOS[0];
      const reply = await roleplayChatAI({
        scenario: meta.label,
        level,
        targetWords: scenario === 'daily-words' ? dailyWords : undefined,
        history: nextHistory.map((m) => ({ role: m.role, text: m.hanzi })),
        userMessage: text
      });
      setRpMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          hanzi: reply.replyHanzi,
          pinyin: reply.replyPinyin,
          translationVi: reply.replyVi,
          tutorFeedback: reply.tutorFeedback
        }
      ]);
      setSuggestedReplies(reply.suggestedReplies);
      await recordStudyActivity({ expEarned: 10 });
      speakChinese(reply.replyHanzi, { silentError: true }).catch(() => {});
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi gửi tin nhắn AI', 'error');
    } finally {
      setRpLoading(false);
    }
  };

  const handleToggleRoleplayMic = async () => {
    if (rpRecording && rpVoiceRef.current) {
      setRpRecording(false);
      const sess = rpVoiceRef.current;
      rpVoiceRef.current = null;
      const res = await sess.stopAndTranscribe();
      if (res.transcript) {
        setRpInput((prev) => (prev ? `${prev} ${res.transcript}` : res.transcript));
      } else {
        pushToast('Không nhận diện được giọng nói tiếng Trung.', 'info');
      }
      return;
    }
    try {
      const prefix = rpInput.trim();
      rpVoiceRef.current = await startChineseSpeechSession({
        lang: 'zh-CN',
        onInterim: (live) => {
          if (live) setRpInput(prefix ? `${prefix} ${live}` : live);
        }
      });
      setRpRecording(true);
      pushToast('🎙️ Mic đang BẬT (Tiếng Trung) — nói xong bấm lại nút Mic để tắt.', 'info');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Không bật được Micro', 'warning');
    }
  };

  // --- Handler Tab 3: Sentence Drill ---
  const handleSubmitDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drillInput.trim() || drillWords.length === 0 || drillLoading) return;
    setDrillLoading(true);
    try {
      const targets = drillWords.map((w) => w.simplified);
      const res = await gradeSentenceCreationAI(targets, drillInput.trim());
      setDrillGrade(res);

      if (res.score >= 7) {
        for (const w of drillWords) {
          await recordVocabReview(
            w.id,
            w.simplified,
            res.score >= 9 ? Rating.Easy : Rating.Good,
            { baseExp: 14 }
          );
        }
        pushToast(
          `Xuất sắc (${res.score}/10)! Đã tự động cộng tiến độ FSRS cho ${drillWords.length} từ!`,
          'success'
        );
      } else {
        await recordStudyActivity({ expEarned: 5 });
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi chấm đặt câu AI', 'error');
    } finally {
      setDrillLoading(false);
    }
  };

  const maxHsk = settings.hskStandard === 'hsk3' ? 9 : 6;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('free-tutor')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
              activeTab === 'free-tutor'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Gia sư Tự do (Việt/Trung)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roleplay')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
              activeTab === 'roleplay'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Đóng vai</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drill')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
              activeTab === 'drill'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <PenLine className="w-4 h-4" />
            <span>Đặt câu FSRS</span>
          </button>
        </div>

        <select
          value={level}
          onChange={(e) => {
            const nextLv = Number(e.target.value);
            setLevel(nextLv);
            updateSettings({ targetHskLevel: nextLv });
          }}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold"
        >
          {Array.from({ length: maxHsk }, (_, i) => i + 1).map((lv) => (
            <option key={lv} value={lv}>
              Trình độ HSK {lv}
            </option>
          ))}
        </select>
      </div>

      <DisplayControlBar compact />

      {/* ==================== TAB 1: GIA SƯ HỎI ĐÁP & CHỮA BÀI TỰ DO (STREAMING) ==================== */}
      {activeTab === 'free-tutor' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-245px)] min-h-[480px]">
          <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-950/50">
            <div className="flex items-center gap-2 min-w-0">
              <GraduationCap className="w-5 h-5 text-brand-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-extrabold truncate">
                  Gia sư AI Song ngữ — Hỏi đáp, Giảng bài &amp; Sửa lỗi sai 1-1
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  Nhắn/nói tiếng Việt hoặc tiếng Trung, dán câu/bài tập hoặc chụp ảnh đề để AI kiểm tra lỗi sai ngay
                </div>
              </div>
            </div>
            {freeMessages.length > 0 && (
              <button
                type="button"
                onClick={handleClearFreeChat}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Bắt đầu cuộc trò chuyện mới"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Mới</span>
              </button>
            )}
          </div>

          {/* Luồng tin nhắn */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {freeMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-6">
                <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center">
                  <Bot className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-md">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Xin chào! Tôi là Gia sư tiếng Trung riêng của bạn (HSK {level}).
                  </p>
                  <p className="text-xs text-slate-500">
                    Bạn có thể hỏi bất cứ điều gì bằng <strong>tiếng Việt</strong> hoặc{' '}
                    <strong>tiếng Trung</strong>: giải bài tập, chấm lỗi sai câu văn, giải thích ngữ pháp, hoặc bấm ảnh chụp trang sách!
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl text-left">
                  {QUICK_PROMPTS.map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendFreeTutor(q)}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-400 bg-slate-50/70 dark:bg-slate-950/50 p-2.5 text-xs text-slate-700 dark:text-slate-300 transition"
                    >
                      <span className="font-semibold text-brand-600 mr-1">✦</span>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              freeMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  } space-y-1`}
                >
                  <div
                    className={`max-w-[92%] sm:max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-brand-600 text-white rounded-br-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm'
                    }`}
                  >
                    {msg.imagePreview && (
                      <img
                        src={msg.imagePreview}
                        alt="Ảnh bài tập đính kèm"
                        className="max-h-48 rounded-xl mb-2 border border-white/20"
                      />
                    )}
                    {msg.role === 'user' ? (
                      <div className="text-sm whitespace-pre-wrap break-words">{msg.text}</div>
                    ) : msg.text ? (
                      <RichTutorMessageBody text={msg.text} />
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                        <span>Gia sư đang trả lời...</span>
                      </div>
                    )}
                  </div>
                  {msg.role === 'model' && msg.modelUsed && (
                    <span className="text-[10px] text-slate-400 px-1">{msg.modelUsed}</span>
                  )}
                </div>
              ))
            )}
            <div ref={freeBottomRef} />
          </div>

          {/* Xem trước ảnh bài tập đính kèm */}
          {attachedImage && (
            <div className="px-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50/60 dark:bg-slate-950/40">
              <img
                src={attachedImage.preview}
                alt="Preview"
                className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
              />
              <span className="text-xs text-slate-500 flex-1">
                Đã đính kèm ảnh bài tập — nhập câu hỏi hoặc bấm Gửi để Gia sư giải &amp; chữa lỗi!
              </span>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Thanh nhập liệu + Đính kèm ảnh + Chuyển ngôn ngữ Mic (VN/ZH) + Nút Mic 1 chạm */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendFreeTutor();
            }}
            className="p-2.5 sm:p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
          >
            {freeRecording && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                  Đang lắng nghe ({micLang === 'vi-VN' ? 'Tiếng Việt' : 'Tiếng Trung'})... Nói xong bấm nút Tắt Mic!
                </span>
                <button
                  type="button"
                  onClick={handleToggleFreeMic}
                  className="underline font-bold"
                >
                  Tắt Mic
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 sm:gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleAttachImage}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0"
                title="Đính kèm ảnh bài tập / đoạn văn để Gia sư chấm"
              >
                <ImagePlus className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={freeInput}
                onChange={(e) => setFreeInput(e.target.value)}
                placeholder="Hỏi bài bằng tiếng Việt hoặc tiếng Trung, dán câu cần sửa lỗi..."
                className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              {/* Chuyển nhanh ngôn ngữ Mic: Việt <-> Trung */}
              <button
                type="button"
                disabled={freeRecording}
                onClick={() => setMicLang((l) => (l === 'vi-VN' ? 'zh-CN' : 'vi-VN'))}
                className="px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-extrabold text-slate-700 dark:text-slate-200 shrink-0 disabled:opacity-50"
                title="Chuyển ngôn ngữ nhận diện giọng nói (Việt / Trung)"
              >
                {micLang === 'vi-VN' ? 'VI' : '中文'}
              </button>

              <button
                type="button"
                onClick={handleToggleFreeMic}
                className={`p-2.5 rounded-xl border transition shrink-0 ${
                  freeRecording
                    ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={
                  freeRecording
                    ? 'Bấm lần 2 để TẮT Mic'
                    : `Bấm lần 1 để BẬT Mic (${micLang === 'vi-VN' ? 'Tiếng Việt' : 'Tiếng Trung'})`
                }
              >
                {freeRecording ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              {freeLoading ? (
                <button
                  type="button"
                  onClick={handleStopStream}
                  className="inline-flex items-center gap-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2.5 text-xs font-bold shrink-0"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Dừng</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!freeInput.trim() && !attachedImage}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3.5 sm:px-4 py-2.5 text-xs font-bold disabled:opacity-40 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Gửi</span>
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ==================== TAB 2: ROLEPLAY CHAT ==================== */}
      {activeTab === 'roleplay' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-250px)] min-h-[480px]">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 bg-slate-50/70 dark:bg-slate-950/50">
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="flex-1 min-w-[200px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold"
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => startNewRoleplay(scenario)}
              disabled={rpLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-1.5 text-xs font-bold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{rpMessages.length === 0 ? 'Bắt đầu đóng vai' : 'Tạo cuộc thoại mới'}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {rpMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2 py-8">
                <Bot className="w-12 h-12 text-brand-400/70" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Chọn tình huống và bấm "Bắt đầu đóng vai" để luyện phản xạ tiếng Trung
                </p>
                {scenario === 'daily-words' && dailyWords.length > 0 && (
                  <p className="text-xs max-w-md">
                    Gia sư sẽ tự động lồng ghép các từ mục tiêu:{' '}
                    <span className="font-hanzi text-brand-600 font-semibold">
                      {dailyWords.slice(0, 8).join('、')}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              rpMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  } space-y-2`}
                >
                  {msg.tutorFeedback && (
                    <div className="max-w-[92%] rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/60 p-3 text-xs space-y-1">
                      <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          Góp ý từ Gia sư{' '}
                          {msg.tutorFeedback.hasError ? '(Cần chỉnh nhẹ)' : '(Rất tự nhiên!)'}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300">
                        {msg.tutorFeedback.explanationVi}
                      </p>
                      <div className="font-hanzi text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        → {msg.tutorFeedback.correctedHanzi}{' '}
                        <span className="font-sans text-xs font-normal opacity-80">
                          ({msg.tutorFeedback.correctedPinyin})
                        </span>
                      </div>
                      {msg.tutorFeedback.naturalTipVi && (
                        <p className="text-slate-500 italic">{msg.tutorFeedback.naturalTipVi}</p>
                      )}
                    </div>
                  )}

                  <div
                    className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-brand-600 text-white rounded-br-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div className="font-hanzi text-base">{msg.hanzi}</div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <InteractiveHanziText
                            text={msg.hanzi}
                            hanziClassName="text-base sm:text-lg font-medium"
                            sentencePinyin={msg.pinyin}
                            sentenceTranslationVi={msg.translationVi}
                            allowShadowing
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => speakChinese(msg.hanzi).catch(() => {})}
                          className="shrink-0 p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/70 text-brand-600 hover:bg-white"
                          title="Nghe gia sư nói"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {rpLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                <span>Gia sư AI đang phản hồi...</span>
              </div>
            )}
            <div ref={rpBottomRef} />
          </div>

          {suggestedReplies.length > 0 && (
            <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowSuggestions((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>{showSuggestions ? 'Ẩn gợi ý trả lời' : 'Gợi ý 3 cách trả lời khi bí'}</span>
              </button>
              {showSuggestions && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {suggestedReplies.map((sr, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendRoleplay(sr.hanzi)}
                      className="text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand-500 p-2.5 transition"
                    >
                      <div className="font-hanzi text-sm font-bold">{sr.hanzi}</div>
                      <div className="text-[11px] text-brand-600">{sr.pinyin}</div>
                      <div className="text-[11px] text-slate-500">{sr.meaningVi}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendRoleplay();
            }}
            className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900"
          >
            <input
              type="text"
              value={rpInput}
              onChange={(e) => setRpInput(e.target.value)}
              placeholder="Nhập tiếng Trung (hoặc bấm Mic 1 chạm bật/tắt)..."
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm font-hanzi focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={handleToggleRoleplayMic}
              className={`p-2.5 rounded-xl border transition ${
                rpRecording
                  ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={rpRecording ? 'Bấm lần 2 để tắt Mic' : 'Bấm lần 1 để bật Mic tiếng Trung'}
            >
              {rpRecording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              type="submit"
              disabled={!rpInput.trim() || rpLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 text-xs font-bold disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Gửi</span>
            </button>
          </form>
        </div>
      )}

      {/* ==================== TAB 3: LUYỆN ĐẶT CÂU FSRS ==================== */}
      {activeTab === 'drill' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Luyện Đặt câu Thực chiến (Đạt ≥ 7 điểm cộng FSRS)</h2>
              <p className="text-xs text-slate-500">
                Đặt 1 câu hoặc đoạn thoại ngắn dùng các từ mục tiêu bên dưới.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 text-xs">
                {([1, 2, 3] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setDrillCount(n);
                      loadDrillWords(n);
                    }}
                    className={`px-2.5 py-1 rounded-md font-bold ${
                      drillCount === n ? 'bg-brand-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    {n} từ
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => loadDrillWords(drillCount)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Đổi bộ từ
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {drillWords.map((w) => (
              <div
                key={w.id}
                className="rounded-xl bg-brand-50/70 dark:bg-brand-950/35 border border-brand-200/70 dark:border-brand-800/60 p-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-hanzi text-2xl font-bold text-brand-700 dark:text-brand-300">
                    {w.simplified}
                  </span>
                  <button
                    type="button"
                    onClick={() => speakChinese(w.simplified).catch(() => {})}
                    className="p-1.5 rounded-lg hover:bg-white/60 text-brand-600"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs font-semibold text-brand-600 mt-0.5">{w.pinyin}</div>
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {w.meanings.join('; ')}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmitDrill} className="space-y-3">
            <textarea
              rows={3}
              value={drillInput}
              onChange={(e) => setDrillInput(e.target.value)}
              placeholder={`Viết câu tiếng Trung có chứa: ${drillWords.map((w) => w.simplified).join('、')}...`}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 font-hanzi text-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={!drillInput.trim() || drillLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 text-sm font-bold shadow-sm disabled:opacity-40"
            >
              {drillLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>AI chấm điểm &amp; nâng cấp câu</span>
            </button>
          </form>

          {drillGrade && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-6 h-6 ${
                      drillGrade.score >= 7 ? 'text-emerald-600' : 'text-amber-500'
                    }`}
                  />
                  <span className="text-lg font-extrabold">
                    Điểm số: {drillGrade.score} / 10
                  </span>
                </div>
                {drillGrade.score >= 7 && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    + Đã cộng tiến độ FSRS!
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-700 dark:text-slate-200">{drillGrade.summaryVi}</p>

              {drillGrade.corrections.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase text-slate-400">
                    Chi tiết sửa lỗi (Đỏ → Xanh)
                  </div>
                  {drillGrade.corrections.map((c, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1"
                    >
                      <div className="flex flex-wrap items-center gap-2 font-hanzi text-base">
                        <span className="line-through bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 rounded">
                          {c.wrongPart}
                        </span>
                        <span>→</span>
                        <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded font-bold">
                          {c.fixedPart}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">{c.reasonVi}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 space-y-1">
                  <div className="text-xs font-bold text-sky-600 dark:text-sky-400">
                    Phiên bản nâng cấp 1 · Khẩu ngữ tự nhiên
                  </div>
                  <InteractiveHanziText
                    text={drillGrade.spokenUpgrade.hanzi}
                    hanziClassName="text-base font-semibold"
                    sentencePinyin={drillGrade.spokenUpgrade.pinyin}
                    sentenceTranslationVi={drillGrade.spokenUpgrade.meaningVi}
                    allowShadowing
                  />
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 space-y-1">
                  <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    Phiên bản nâng cấp 2 · Văn viết trang trọng
                  </div>
                  <InteractiveHanziText
                    text={drillGrade.writtenUpgrade.hanzi}
                    hanziClassName="text-base font-semibold"
                    sentencePinyin={drillGrade.writtenUpgrade.pinyin}
                    sentenceTranslationVi={drillGrade.writtenUpgrade.meaningVi}
                    allowShadowing
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
