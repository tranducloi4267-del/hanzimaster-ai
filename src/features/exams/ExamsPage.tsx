import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  History,
  Loader2,
  Sparkles,
  Upload,
  Volume2,
  XCircle
} from 'lucide-react';
import { db } from '@/db/database';
import { OFFLINE_MOCK_EXAMS } from '@/data/mockExams';
import {
  explainExamMistakesAI,
  generateHskExamAI,
  importExamFromContentAI
} from '@/services/ai/aiTasks';
import { parseRawInputForExamOrDoc } from '@/services/parser/documentParser';
import { speakChinese } from '@/services/tts/ttsService';
import { getLeechVocabItems, recordStudyActivity } from '@/services/fsrs/fsrsService';
import { useAppStore } from '@/stores/useAppStore';
import type {
  ExamAiExplanation,
  ExamHistoryItem,
  ExamQuestion,
  ExamSection
} from '@/types';
import { createId } from '@/utils/pinyin';
import { DisplayControlBar } from '@/components/common/DisplayControlBar';
import { InteractiveHanziText } from '@/components/common/InteractiveHanziText';

interface ActiveExam {
  id: string;
  title: string;
  level: number;
  source: 'offline-mock' | 'ai-generated' | 'imported';
  durationMinutes: number;
  sections: ExamSection[];
}

export const ExamsPage: React.FC = () => {
  const { settings, pushToast } = useAppStore();

  const [history, setHistory] = useState<ExamHistoryItem[]>([]);
  const [activeExam, setActiveExam] = useState<ActiveExam | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submittedRecord, setSubmittedRecord] = useState<ExamHistoryItem | null>(null);
  const [aiExplanations, setAiExplanations] = useState<Record<string, ExamAiExplanation>>({});
  const [explaining, setExplaining] = useState(false);

  // AI Generator options
  const [genLevel, setGenLevel] = useState(settings.targetHskLevel || 2);
  const [genSkill, setGenSkill] = useState<'all' | 'listening' | 'reading' | 'writing'>('all');
  const [includeLeeches, setIncludeLeeches] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadHistory = async () => {
    const items = await db.examHistory.orderBy('createdAt').reverse().limit(20).toArray();
    setHistory(items);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Countdown timer in Exam Room
  useEffect(() => {
    if (!activeExam || submittedRecord) return;
    if (secondsLeft <= 0) {
      handleSubmitExam();
      return;
    }
    const t = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, activeExam, submittedRecord]);

  const allQuestions: ExamQuestion[] = useMemo(() => {
    if (!activeExam) return [];
    return activeExam.sections.flatMap((s) => s.questions);
  }, [activeExam]);

  const startExam = (exam: ActiveExam) => {
    setActiveExam(exam);
    setUserAnswers({});
    setSubmittedRecord(null);
    setAiExplanations({});
    setSecondsLeft(exam.durationMinutes * 60);
  };

  const openHistoryRecord = (rec: ExamHistoryItem) => {
    const sections = JSON.parse(rec.sectionsJson) as ExamSection[];
    const answers = JSON.parse(rec.userAnswersJson) as Record<string, string>;
    const exps: Record<string, ExamAiExplanation> = {};
    if (rec.aiExplanationsJson) {
      try {
        const arr = JSON.parse(rec.aiExplanationsJson) as ExamAiExplanation[];
        for (const e of arr) exps[e.questionId] = e;
      } catch {
        // ignore
      }
    }
    setActiveExam({
      id: rec.id,
      title: rec.title,
      level: rec.level,
      source: rec.source,
      durationMinutes: rec.durationMinutes,
      sections
    });
    setUserAnswers(answers);
    setSubmittedRecord(rec);
    setAiExplanations(exps);
  };

  const handleGenerateAiExam = async () => {
    setGenerating(true);
    try {
      let focusWords: string[] = [];
      if (includeLeeches) {
        const leeches = await getLeechVocabItems(10);
        focusWords = leeches.map((l) => l.simplified);
      }
      const res = await generateHskExamAI({
        level: genLevel,
        skill: genSkill,
        focusWords
      });
      startExam({
        id: createId('exam_ai'),
        title: res.title,
        level: res.level,
        source: 'ai-generated',
        durationMinutes: res.durationMinutes,
        sections: res.sections
      });
      pushToast('Đã sinh đề thi HSK mới bằng Gemini AI!', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi sinh đề AI', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleImportExamFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setGenerating(true);
    try {
      const prepared = await parseRawInputForExamOrDoc({ kind: 'file', file });
      const res = await importExamFromContentAI({
        text: prepared.text,
        imagesBase64: prepared.imagesBase64
      });
      startExam({
        id: createId('exam_imp'),
        title: res.title || prepared.title,
        level: res.level,
        source: 'imported',
        durationMinutes: res.durationMinutes,
        sections: res.sections
      });
      pushToast('Đã bóc tách đề thi thành phòng thi tương tác!', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi nạp đề thi', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const isQuestionCorrect = (q: ExamQuestion, ans: string): boolean => {
    const cleanAns = (ans || '').trim();
    if (!cleanAns) return false;
    if (q.options && q.options.length > 0) {
      return cleanAns.toUpperCase() === q.correctAnswer.trim().toUpperCase();
    }
    const stripPunct = (s: string) => s.replace(/[。？！，、,.!?\s]/g, '');
    return stripPunct(cleanAns) === stripPunct(q.correctAnswer);
  };

  const handleSubmitExam = async () => {
    if (!activeExam || submittedRecord) return;
    let score = 0;
    const totalPoints = allQuestions.length * 10;

    for (const q of allQuestions) {
      const ans = userAnswers[q.id] || '';
      if (isQuestionCorrect(q, ans)) {
        score += 10;
      } else if (q.section === 'writing' && ans.trim().length >= 5) {
        score += 5; // điểm khuyến khích sơ bộ trước khi AI chấm chi tiết phần Viết
      }
    }

    const record: ExamHistoryItem = {
      id: activeExam.id,
      title: activeExam.title,
      level: activeExam.level,
      source: activeExam.source,
      durationMinutes: activeExam.durationMinutes,
      sectionsJson: JSON.stringify(activeExam.sections),
      userAnswersJson: JSON.stringify(userAnswers),
      score,
      totalPoints,
      createdAt: Date.now()
    };

    await db.examHistory.put(record);
    await recordStudyActivity({ expEarned: Math.max(15, Math.round(score / 2)), minutesStudied: 10 });
    setSubmittedRecord(record);
    await loadHistory();
    pushToast(`Đã nộp bài! Điểm sơ bộ: ${score}/${totalPoints}`, 'success');
  };

  const handleExplainWithAI = async () => {
    if (!activeExam || !submittedRecord) return;
    const targets = allQuestions
      .filter((q) => !isQuestionCorrect(q, userAnswers[q.id] || '') || q.section === 'writing')
      .map((q) => ({ question: q, userAnswer: userAnswers[q.id] || '' }));

    if (targets.length === 0) {
      pushToast('Tuyệt vời! Bạn làm đúng 100% mọi câu trắc nghiệm!', 'success');
      return;
    }

    setExplaining(true);
    try {
      const exps = await explainExamMistakesAI(submittedRecord.id, activeExam.level, targets);
      const map: Record<string, ExamAiExplanation> = {};
      for (const e of exps) map[e.questionId] = e;
      setAiExplanations(map);

      // Cập nhật lại điểm nếu AI chấm chi tiết phần Viết
      let updatedScore = 0;
      for (const q of allQuestions) {
        const exp = map[q.id];
        if (q.section === 'writing' && typeof exp?.writingScore === 'number') {
          updatedScore += exp.writingScore;
        } else if (isQuestionCorrect(q, userAnswers[q.id] || '')) {
          updatedScore += 10;
        }
      }

      const updatedRec: ExamHistoryItem = {
        ...submittedRecord,
        score: updatedScore,
        aiExplanationsJson: JSON.stringify(exps)
      };
      await db.examHistory.put(updatedRec);
      setSubmittedRecord(updatedRec);
      await loadHistory();
      pushToast('AI đã giải đề chi tiết & lưu cache xem offline mãi mãi!', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi AI giải đề', 'error');
    } finally {
      setExplaining(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // PHÒNG THI / XEM LẠI BÀI ĐÃ CHẤM
  if (activeExam) {
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-20 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-2">
          <div>
            <button
              type="button"
              onClick={() => {
                setActiveExam(null);
                setSubmittedRecord(null);
              }}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              ← Quay lại danh sách đề
            </button>
            <h2 className="text-sm sm:text-base font-bold">{activeExam.title}</h2>
          </div>

          <div className="flex items-center gap-2">
            {!submittedRecord ? (
              <>
                <span
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold ${
                    secondsLeft <= 120
                      ? 'bg-rose-100 text-rose-700 animate-pulse'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  {formatTimer(secondsLeft)}
                </span>
                <button
                  type="button"
                  onClick={handleSubmitExam}
                  className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-xs font-bold shadow-sm"
                >
                  Nộp bài ({Object.keys(userAnswers).length}/{allQuestions.length})
                </button>
              </>
            ) : (
              <>
                <span className="rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-3.5 py-1.5 text-sm font-extrabold">
                  Điểm: {submittedRecord.score} / {submittedRecord.totalPoints}
                </span>
                <button
                  type="button"
                  disabled={explaining}
                  onClick={handleExplainWithAI}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-amber-600 text-white px-3.5 py-2 text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {explaining ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>AI Giải đề chi tiết & Chấm Viết</span>
                </button>
              </>
            )}
          </div>
        </div>

        <DisplayControlBar compact />

        {/* Bảng điều hướng câu nhanh */}
        <div className="flex flex-wrap gap-1.5">
          {allQuestions.map((q, idx) => {
            const answered = Boolean((userAnswers[q.id] || '').trim());
            const ok = submittedRecord && isQuestionCorrect(q, userAnswers[q.id] || '');
            const cls = submittedRecord
              ? ok
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-rose-600 text-white border-rose-600'
              : answered
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700';
            return (
              <a
                key={q.id}
                href={`#q_${q.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`q_${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className={`w-8 h-8 rounded-lg border text-xs font-bold flex items-center justify-center ${cls}`}
              >
                {idx + 1}
              </a>
            );
          })}
        </div>

        {/* Các phần thi */}
        {activeExam.sections.map((section, sIdx) => (
          <div
            key={sIdx}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4"
          >
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="text-base font-bold">{section.title}</h3>
              <p className="text-xs text-slate-500">{section.instructionsVi}</p>
            </div>

            <div className="space-y-4">
              {section.questions.map((q, qIdx) => {
                const ans = userAnswers[q.id] || '';
                const correct = submittedRecord ? isQuestionCorrect(q, ans) : false;
                const aiExp = aiExplanations[q.id];

                return (
                  <div
                    id={`q_${q.id}`}
                    key={q.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="text-xs font-bold text-brand-600 uppercase">
                          Câu {qIdx + 1}
                        </span>
                        <InteractiveHanziText
                          text={q.promptHanzi}
                          hanziClassName="text-lg font-semibold mt-0.5"
                          sentencePinyin={q.promptPinyin}
                          sentenceTranslationVi={q.promptVi}
                        />
                      </div>
                      {submittedRecord &&
                        (correct ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
                        ))}
                    </div>

                    {/* Nút phát âm TTS cho phần Nghe */}
                    {q.audioText && (
                      <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/35 border border-indigo-200/70 dark:border-indigo-800/50 p-3 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => speakChinese(q.audioText!, { rate: 0.9 }).catch(() => {})}
                          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 text-xs font-bold"
                        >
                          <Volume2 className="w-4 h-4" />
                          <span>Nghe bài đọc (TTS)</span>
                        </button>
                        {submittedRecord && (
                          <div className="w-full pt-2 border-t border-indigo-200/50 dark:border-indigo-800/50 text-xs">
                            <span className="font-bold text-indigo-700 dark:text-indigo-300">
                              Kịch bản gốc:{' '}
                            </span>
                            <InteractiveHanziText text={q.audioText} hanziClassName="text-sm" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Trắc nghiệm hoặc Viết */}
                    {q.options && q.options.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt) => {
                          const picked = ans === opt.key;
                          const isRightOpt = submittedRecord && opt.key === q.correctAnswer;
                          const cls = submittedRecord
                            ? isRightOpt
                              ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-950/50'
                              : picked
                                ? 'bg-rose-50 border-rose-500 dark:bg-rose-950/50'
                                : 'border-slate-200 dark:border-slate-800 opacity-60'
                            : picked
                              ? 'bg-brand-50 border-brand-600 dark:bg-brand-950/40'
                              : 'border-slate-200 dark:border-slate-700 hover:border-brand-400';

                          return (
                            <button
                              key={opt.key}
                              type="button"
                              disabled={Boolean(submittedRecord)}
                              onClick={() => setUserAnswers((prev) => ({ ...prev, [q.id]: opt.key }))}
                              className={`rounded-xl border-2 p-3 text-left transition flex items-baseline gap-2.5 ${cls}`}
                            >
                              <span className="font-bold text-xs w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                {opt.key}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="font-hanzi text-base font-semibold">
                                  {opt.hanzi}
                                </span>
                                {opt.pinyin && (
                                  <span className="ml-2 text-xs text-slate-500">{opt.pinyin}</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <textarea
                        rows={2}
                        disabled={Boolean(submittedRecord)}
                        value={ans}
                        onChange={(e) => setUserAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Nhập câu tiếng Trung Giản thể trả lời của bạn..."
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-hanzi text-base"
                      />
                    )}

                    {/* Giải thích đáp án (Offline sẵn có + AI chi tiết đã cache) */}
                    {submittedRecord && (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3.5 text-xs space-y-1.5">
                        <div className="font-bold text-emerald-700 dark:text-emerald-400">
                          Đáp án chuẩn: <span className="font-hanzi text-sm">{q.correctAnswer}</span>
                        </div>
                        {q.explanationVi && !aiExp && (
                          <p className="text-slate-600 dark:text-slate-300">{q.explanationVi}</p>
                        )}
                        {aiExp && (
                          <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                            <div className="font-bold text-brand-600 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>
                                Lời giải chi tiết AI (đã lưu offline)
                                {typeof aiExp.writingScore === 'number'
                                  ? ` · Điểm Viết: ${aiExp.writingScore}/10`
                                  : ''}
                              </span>
                            </div>
                            <p>
                              <strong>Vì sao đúng:</strong> {aiExp.whyCorrectVi}
                            </p>
                            <p>
                              <strong>Bẫy đáp án sai:</strong> {aiExp.distractorTrapVi}
                            </p>
                            <p>
                              <strong>Ngữ pháp mấu chốt:</strong> {aiExp.grammarPointVi}
                            </p>
                            <p>
                              <strong>Dịch nghĩa:</strong> {aiExp.translationVi}
                            </p>
                            {aiExp.writingRevisionHanzi && (
                              <div>
                                <strong>Gợi ý câu viết chuẩn hơn:</strong>
                                <InteractiveHanziText
                                  text={aiExp.writingRevisionHanzi}
                                  hanziClassName="text-sm font-semibold"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // MÀN HÌNH TRUNG TÂM ĐỀ THI HSK (3 NGUỒN + LỊCH SỬ)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Nguồn 1: Bộ đề mẫu Offline */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span>1. Đề mẫu chuẩn Offline</span>
          </div>
          <div className="space-y-2.5">
            {OFFLINE_MOCK_EXAMS.map((mock) => (
              <div
                key={mock.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2"
              >
                <div className="font-bold text-xs">{mock.title}</div>
                <p className="text-[11px] text-slate-500">{mock.descriptionVi}</p>
                <button
                  type="button"
                  onClick={() =>
                    startExam({
                      id: createId(mock.id),
                      title: mock.title,
                      level: mock.level,
                      source: 'offline-mock',
                      durationMinutes: mock.durationMinutes,
                      sections: mock.sections
                    })
                  }
                  className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 text-xs font-bold"
                >
                  Vào phòng thi ({mock.durationMinutes} phút)
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Nguồn 2: AI tự sinh đề HSK 1–6 */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Sparkles className="w-5 h-5 text-brand-600" />
            <span>2. AI tự sinh đề HSK 1–6</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-500 mb-1">Cấp độ HSK</label>
              <select
                value={genLevel}
                onChange={(e) => setGenLevel(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-semibold"
              >
                {[1, 2, 3, 4, 5, 6].map((lv) => (
                  <option key={lv} value={lv}>
                    HSK {lv}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-500 mb-1">Kỹ năng luyện</label>
              <select
                value={genSkill}
                onChange={(e) => setGenSkill(e.target.value as typeof genSkill)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-semibold"
              >
                <option value="all">Tổng hợp (Nghe + Đọc + Viết)</option>
                <option value="listening">Chuyên sâu Nghe hiểu</option>
                <option value="reading">Chuyên sâu Đọc hiểu</option>
                <option value="writing">Chuyên sâu Viết câu</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeLeeches}
                onChange={(e) => setIncludeLeeches(e.target.checked)}
                className="rounded text-brand-600"
              />
              <span>Ưu tiên nhồi từ hay sai / tử huyệt của tôi</span>
            </label>
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerateAiExam}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white py-2.5 text-xs font-bold shadow-sm disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Sinh đề thi ngay bằng Gemini</span>
            </button>
          </div>
        </div>

        {/* Nguồn 3: Nạp đề từ Ảnh / PDF / DOCX */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Upload className="w-5 h-5 text-indigo-600" />
              <span>3. Nạp đề từ Ảnh / PDF / DOCX</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Chụp ảnh hoặc tải đề thi HSK giấy/PDF/Word của bạn — Gemini AI tự động bóc tách thành
              câu hỏi trắc nghiệm & tự luận tương tác, chấm điểm và giải thích từng câu.
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.docx,.txt"
              onChange={handleImportExamFile}
              className="hidden"
            />
            <button
              type="button"
              disabled={generating}
              onClick={() => fileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 py-3 text-xs font-bold"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>Chọn file đề thi để bóc tách</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lịch sử bài làm & lời giải đã cache offline */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <History className="w-4 h-4 text-brand-600" />
          <span>Lịch sử làm đề & lời giải AI đã lưu Offline ({history.length})</span>
        </h3>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500">
            Bạn chưa hoàn thành bài thi nào. Hãy chọn một đề mẫu Offline ở trên để thử sức ngay!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {history.map((rec) => (
              <button
                key={rec.id}
                type="button"
                onClick={() => openHistoryRecord(rec)}
                className="text-left rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-400 p-3.5 transition flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{rec.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    HSK {rec.level} · {new Date(rec.createdAt).toLocaleString('vi-VN')}
                    {rec.aiExplanationsJson ? ' · Đã có lời giải AI Offline' : ''}
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 text-xs font-extrabold">
                  {rec.score}/{rec.totalPoints}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
