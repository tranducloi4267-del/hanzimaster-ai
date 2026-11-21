import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Play, Repeat, Square, Volume2, X } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { speakChinese, stopSpeaking } from '@/services/tts/ttsService';
import {
  evaluateShadowing,
  startChineseSpeechSession,
  type ActiveRecordingSession,
  type ShadowingEvaluation,
  type SttResult
} from '@/services/stt/sttService';
import { recordStudyActivity } from '@/services/fsrs/fsrsService';

/**
 * Shadowing Mode toàn cục:
 * (1) Nghe mẫu (chỉnh tốc độ 0.6x–1.2x, lặp A-B)
 * (2) Bấm Mic nói theo (STT 3 tầng: Capacitor / Web Speech / Electron MediaRecorder + Gemini Audio)
 * (3) So khớp từng chữ: Xanh (đúng) | Đỏ (sai/lệch âm) | Vàng (thiếu) + % chuẩn + đối chiếu Pinyin
 */
export const ShadowingModal: React.FC = () => {
  const { shadowingTarget, closeShadowing, pushToast } = useAppStore();

  const [rate, setRate] = useState(0.9);
  const [abLoop, setAbLoop] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sttResult, setSttResult] = useState<SttResult | null>(null);
  const [evaluation, setEvaluation] = useState<ShadowingEvaluation | null>(null);

  const sessionRef = useRef<ActiveRecordingSession | null>(null);
  const loopActiveRef = useRef(false);

  useEffect(() => {
    setSttResult(null);
    setEvaluation(null);
    setAbLoop(false);
    loopActiveRef.current = false;
    return () => {
      loopActiveRef.current = false;
      stopSpeaking();
      sessionRef.current?.cancel();
    };
  }, [shadowingTarget]);

  if (!shadowingTarget) return null;

  const playSample = async (loopMode = false) => {
    setSpeaking(true);
    try {
      do {
        await speakChinese(shadowingTarget.hanzi, { rate });
        if (loopMode && loopActiveRef.current) {
          await new Promise((r) => setTimeout(r, 700));
        }
      } while (loopMode && loopActiveRef.current);
    } catch {
      pushToast('Không thể phát giọng mẫu.', 'warning');
    } finally {
      setSpeaking(false);
    }
  };

  const toggleAbLoop = () => {
    if (abLoop) {
      setAbLoop(false);
      loopActiveRef.current = false;
      stopSpeaking();
    } else {
      setAbLoop(true);
      loopActiveRef.current = true;
      playSample(true);
    }
  };

  const handleToggleRecord = async () => {
    if (recording && sessionRef.current) {
      setRecording(false);
      setProcessing(true);
      try {
        const res = await sessionRef.current.stopAndTranscribe();
        sessionRef.current = null;
        setSttResult(res);

        if (res.transcript) {
          const ev = await evaluateShadowing(
            shadowingTarget.hanzi,
            res.transcript,
            shadowingTarget.pinyin,
            res.recognizedPinyin
          );
          setEvaluation(ev);
          await recordStudyActivity({ expEarned: ev.accuracyPercent >= 75 ? 12 : 5 });
        } else if (res.engine === 'self-check') {
          pushToast(
            'Chế độ Tự đối chiếu (Offline): Bạn có thể nghe lại giọng mình so sánh với mẫu!',
            'info'
          );
        } else {
          pushToast('Không nghe rõ tiếng Trung, hãy thử nói to và rõ hơn.', 'warning');
        }
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'Lỗi xử lý giọng nói', 'error');
      } finally {
        setProcessing(false);
      }
      return;
    }

    // Bắt đầu ghi âm / STT
    loopActiveRef.current = false;
    setAbLoop(false);
    stopSpeaking();
    setSttResult(null);
    setEvaluation(null);

    try {
      const session = await startChineseSpeechSession({ lang: 'zh-CN' });
      sessionRef.current = session;
      setRecording(true);
      pushToast('🎙️ Đang bật Mic — đọc xong bấm lần 2 để tắt & chấm điểm.', 'info');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Không thể bật Micro', 'error');
    }
  };

  const handleClose = () => {
    loopActiveRef.current = false;
    stopSpeaking();
    sessionRef.current?.cancel();
    closeShadowing();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 font-bold text-base">
            <Mic className="w-5 h-5 text-brand-600" />
            <span>Luyện Phát âm & Shadowing</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Đóng Shadowing"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Câu mục tiêu */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-4 text-center space-y-1.5">
            <div className="font-hanzi text-2xl sm:text-3xl font-bold leading-relaxed">
              {shadowingTarget.hanzi}
            </div>
            {shadowingTarget.pinyin && (
              <div className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                {shadowingTarget.pinyin}
              </div>
            )}
            {shadowingTarget.translationVi && (
              <div className="text-xs text-slate-500">{shadowingTarget.translationVi}</div>
            )}
          </div>

          {/* Bước 1: Nghe mẫu + Lặp A-B + Tốc độ */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Bước 1 · Nghe mẫu & cảm nhận ngữ điệu
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => playSample(false)}
                disabled={speaking && !abLoop}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-xs font-bold"
              >
                <Volume2 className="w-4 h-4" />
                <span>Nghe mẫu</span>
              </button>

              <button
                type="button"
                onClick={toggleAbLoop}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                  abLoop
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Repeat className="w-4 h-4" />
                <span>{abLoop ? 'Dừng lặp A-B' : 'Lặp A-B liên tục'}</span>
              </button>

              <div className="ml-auto flex items-center gap-1.5 text-xs">
                <span className="text-slate-500">Tốc độ:</span>
                {[0.6, 0.8, 1.0, 1.2].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRate(r)}
                    className={`px-2 py-1 rounded-lg font-bold ${
                      Math.abs(rate - r) < 0.05
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bước 2: Bấm Mic đọc theo */}
          <div className="text-center space-y-2 pt-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Bước 2 · Bấm Mic đọc nhại theo ngay
            </div>
            <button
              type="button"
              disabled={processing}
              onClick={handleToggleRecord}
              className={`mx-auto inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-lg transition active:scale-95 ${
                recording
                  ? 'bg-rose-600 hover:bg-rose-700 animate-pulse'
                  : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang chấm phát âm...</span>
                </>
              ) : recording ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>Đang thu âm — Bấm để chấm điểm</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  <span>Bắt đầu nói tiếng Trung</span>
                </>
              )}
            </button>
          </div>

          {/* Bước 3: Kết quả so khớp từng chữ (Xanh / Đỏ / Vàng) & Đối chiếu Pinyin */}
          {evaluation && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/70 dark:bg-slate-950/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-500">
                  Bước 3 · So khớp từng chữ
                </span>
                <span
                  className={`text-lg font-extrabold ${
                    evaluation.accuracyPercent >= 80
                      ? 'text-emerald-600'
                      : evaluation.accuracyPercent >= 50
                        ? 'text-amber-600'
                        : 'text-rose-600'
                  }`}
                >
                  Độ chuẩn: {evaluation.accuracyPercent}%
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 justify-center py-2">
                {evaluation.tokens.map((tok, i) => {
                  const cls =
                    tok.status === 'correct'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700'
                      : tok.status === 'wrong'
                        ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-700'
                        : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700';
                  return (
                    <div
                      key={i}
                      className={`rounded-xl border px-2.5 py-1.5 text-center ${cls}`}
                      title={
                        tok.status === 'correct'
                          ? 'Đọc chuẩn'
                          : tok.status === 'wrong'
                            ? `Máy nghe ra: ${tok.spokenChar || '?'}`
                            : 'Bị đọc thiếu'
                      }
                    >
                      <div className="font-hanzi text-2xl font-bold">{tok.char}</div>
                      {tok.status === 'wrong' && tok.spokenChar && (
                        <div className="text-[10px] font-hanzi opacity-80">→ {tok.spokenChar}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Đúng
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Sai / lệch âm
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Thiếu chữ
                </span>
              </div>

              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1.5">
                <div>
                  <strong className="text-slate-500">Pinyin chuẩn:</strong>{' '}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {evaluation.expectedPinyin}
                  </span>
                </div>
                <div>
                  <strong className="text-slate-500">Máy nghe được:</strong>{' '}
                  <span className="font-hanzi font-semibold">{evaluation.spokenHanzi}</span>{' '}
                  <span className="text-brand-600 dark:text-brand-400">
                    ({evaluation.spokenPinyin})
                  </span>
                </div>
                {sttResult?.toneTipVi && (
                  <div className="text-amber-700 dark:text-amber-300 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <strong>Nhận xét thanh điệu:</strong> {sttResult.toneTipVi}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nghe lại bản ghi âm của chính mình (Self-Check trên Electron Offline hoặc sau khi chấm) */}
          {sttResult?.audioUrl && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold flex items-center gap-1.5">
                <Play className="w-4 h-4 text-brand-500" />
                <span>Bản ghi âm của bạn (tự đối chiếu):</span>
              </div>
              <audio controls src={sttResult.audioUrl} className="h-8 max-w-[220px]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
