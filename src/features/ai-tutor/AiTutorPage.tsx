import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Lightbulb,
  Loader2,
  MessageSquare,
  Mic,
  PenLine,
  RefreshCw,
  Send,
  Sparkles,
  Volume2
} from 'lucide-react';
import { db } from '@/db/database';
import {
  gradeSentenceCreationAI,
  roleplayChatAI,
  type RoleplayAiReply,
  type SentenceDrillGrade
} from '@/services/ai/aiTasks';
import { speakChinese } from '@/services/tts/ttsService';
import { startChineseSpeechSession, type ActiveRecordingSession } from '@/services/stt/sttService';
import {
  pickDailyTargetWords,
  Rating,
  recordStudyActivity,
  recordVocabReview
} from '@/services/fsrs/fsrsService';
import { useAppStore } from '@/stores/useAppStore';
import type { DictionaryEntry } from '@/types';
import { DisplayControlBar } from '@/components/common/DisplayControlBar';
import { InteractiveHanziText } from '@/components/common/InteractiveHanziText';

interface ChatMessage {
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

export const AiTutorPage: React.FC = () => {
  const { settings, isOnline, pushToast } = useAppStore();
  const [activeTab, setActiveTab] = useState<'roleplay' | 'drill'>('roleplay');

  // Roleplay state
  const [scenario, setScenario] = useState(SCENARIOS[0].id);
  const [level, setLevel] = useState(settings.targetHskLevel || 2);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestedReplies, setSuggestedReplies] = useState<
    Array<{ hanzi: string; pinyin: string; meaningVi: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [dailyWords, setDailyWords] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const voiceRef = useRef<ActiveRecordingSession | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Sentence Drill state
  const [drillWords, setDrillWords] = useState<DictionaryEntry[]>([]);
  const [drillCount, setDrillCount] = useState<1 | 2 | 3>(2);
  const [drillInput, setDrillInput] = useState('');
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillGrade, setDrillGrade] = useState<SentenceDrillGrade | null>(null);

  const loadDrillWords = async (count = drillCount) => {
    const picked = await pickDailyTargetWords(level, 10);
    const shuffled = [...picked.words].sort(() => Math.random() - 0.5);
    setDrillWords(shuffled.slice(0, count));
    setDrillGrade(null);
    setDrillInput('');
  };

  useEffect(() => {
    pickDailyTargetWords(level, settings.dailyWordGoal || 10).then((r) => {
      setDailyWords(r.words.map((w) => w.simplified));
    });
    loadDrillWords(drillCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startNewRoleplay = async (selectedScenario = scenario) => {
    const meta = SCENARIOS.find((s) => s.id === selectedScenario) || SCENARIOS[0];
    setMessages([]);
    setSuggestedReplies([]);
    setShowSuggestions(false);

    if (!isOnline || !settings.geminiApiKey.trim()) {
      setMessages([
        {
          id: 'welcome_off',
          role: 'assistant',
          hanzi: '你好！欢迎来到口语练习室。我们今天想聊什么话题？',
          pinyin: 'Nǐ hǎo! Huānyíng láidào kǒuyǔ liànxíshì. Wǒmen jīntiān xiǎng liáo shénme huàtí?',
          translationVi:
            'Xin chào! Chào mừng tới phòng luyện giao tiếp. (Hãy nhập Gemini API Key miễn phí trong Cài đặt & kết nối mạng để trò chuyện tương tác trực tiếp với Gia sư AI!)'
        }
      ]);
      return;
    }

    setChatLoading(true);
    try {
      const reply = await roleplayChatAI({
        scenario: meta.label,
        level,
        targetWords: selectedScenario === 'daily-words' ? dailyWords : undefined,
        history: [],
        userMessage: 'Hãy mở lời chào tự nhiên vào tình huống đóng vai bằng 1-2 câu tiếng Trung.'
      });
      setMessages([
        {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          hanzi: reply.replyHanzi,
          pinyin: reply.replyPinyin,
          translationVi: reply.replyVi
        }
      ]);
      setSuggestedReplies(reply.suggestedReplies);
      speakChinese(reply.replyHanzi).catch(() => {});
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi kết nối Gia sư AI', 'error');
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendChat = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || chatLoading) return;
    setInput('');
    setShowSuggestions(false);

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      hanzi: text
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setChatLoading(true);

    try {
      const meta = SCENARIOS.find((s) => s.id === scenario) || SCENARIOS[0];
      const reply = await roleplayChatAI({
        scenario: meta.label,
        level,
        targetWords: scenario === 'daily-words' ? dailyWords : undefined,
        history: nextHistory.map((m) => ({ role: m.role, text: m.hanzi })),
        userMessage: text
      });
      setMessages((prev) => [
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
      speakChinese(reply.replyHanzi).catch(() => {});
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi gửi tin nhắn AI', 'error');
    } finally {
      setChatLoading(false);
    }
  };

  const handleVoiceChat = async () => {
    if (recording && voiceRef.current) {
      setRecording(false);
      const res = await voiceRef.current.stopAndTranscribe();
      voiceRef.current = null;
      if (res.transcript) {
        setInput((prev) => (prev ? `${prev} ${res.transcript}` : res.transcript));
      } else {
        pushToast('Không nhận diện được giọng nói tiếng Trung.', 'info');
      }
      return;
    }
    try {
      voiceRef.current = await startChineseSpeechSession();
      setRecording(true);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Không bật được Micro', 'warning');
    }
  };

  const handleSubmitDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drillInput.trim() || drillWords.length === 0 || drillLoading) return;
    setDrillLoading(true);
    try {
      const targets = drillWords.map((w) => w.simplified);
      const res = await gradeSentenceCreationAI(targets, drillInput.trim());
      setDrillGrade(res);

      // Đạt >= 7 điểm tự cộng tiến độ FSRS cho các từ mục tiêu!
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('roleplay')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'roleplay'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Hội thoại Đóng vai (Roleplay)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('drill')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'drill'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <PenLine className="w-4 h-4" />
            <span>Luyện Đặt câu Thực chiến</span>
          </button>
        </div>

        <select
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold"
        >
          {[1, 2, 3, 4, 5, 6].map((lv) => (
            <option key={lv} value={lv}>
              Trình độ HSK {lv}
            </option>
          ))}
        </select>
      </div>

      <DisplayControlBar compact />

      {/* TAB 1: Roleplay Chat */}
      {activeTab === 'roleplay' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-250px)] min-h-[480px]">
          {/* Chọn tình huống */}
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
              disabled={chatLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-1.5 text-xs font-bold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{messages.length === 0 ? 'Bắt đầu đóng vai' : 'Tạo cuộc thoại mới'}</span>
            </button>
          </div>

          {/* Luồng tin nhắn */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2 py-8">
                <Bot className="w-12 h-12 text-brand-400/70" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Chọn tình huống và bấm "Bắt đầu đóng vai" để luyện phản xạ cùng Gia sư AI
                </p>
                {scenario === 'daily-words' && dailyWords.length > 0 && (
                  <p className="text-xs max-w-md">
                    Gia sư sẽ tự động lồng ghép các từ mục tiêu hôm nay:{' '}
                    <span className="font-hanzi text-brand-600 font-semibold">
                      {dailyWords.slice(0, 8).join('、')}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  } space-y-2`}
                >
                  {/* Thẻ Góp ý từ Gia sư cho câu trước của người dùng */}
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

                  {/* Bong bóng hội thoại */}
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
            {chatLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                <span>Gia sư AI đang suy nghĩ & kiểm tra câu của bạn...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Gợi ý 3 cách trả lời khi bí */}
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
                      onClick={() => handleSendChat(sr.hanzi)}
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

          {/* Ô nhập tin nhắn */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu trả lời tiếng Trung (hoặc bấm Mic nói)..."
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm font-hanzi focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={handleVoiceChat}
              className={`p-2.5 rounded-xl border transition ${
                recording
                  ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Nói tiếng Trung"
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              type="submit"
              disabled={!input.trim() || chatLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 text-xs font-bold disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Gửi</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: Luyện Đặt câu Thực chiến */}
      {activeTab === 'drill' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Luyện Đặt câu Thực chiến (Đạt ≥ 7 điểm cộng FSRS)</h2>
              <p className="text-xs text-slate-500">
                Đặt 1 câu hoặc đoạn thoại ngắn dùng các từ chưa thuộc / tử huyệt bên dưới.
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
              <span>AI chấm điểm & nâng cấp câu</span>
            </button>
          </form>

          {/* Kết quả chấm điểm & sửa lỗi đỏ/xanh + 2 bản nâng cấp */}
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
