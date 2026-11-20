import React, { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import { Eye, EyeOff, Play, RotateCcw, Repeat, AlertCircle, CheckCircle2 } from 'lucide-react';
import { loadHanziWriterCharData } from '@/services/handwriting/hanziWriterLoader';

interface HanziStrokePlayerProps {
  char: string;
  mode: 'animate' | 'quiz';
  size?: number;
  blindMode?: boolean;
  onToggleBlindMode?: (blind: boolean) => void;
  onQuizComplete?: (summary: { totalMistakes: number }) => void;
  onMistake?: (data: { strokeNum: number; mistakesOnStroke: number }) => void;
}

/**
 * Trình phát hoạt ảnh thứ tự nét & luyện viết tương tác dùng hanzi-writer
 * chạy 100% Offline qua custom charDataLoader đọc từ IndexedDB hanziGraphics.
 */
export const HanziStrokePlayer: React.FC<HanziStrokePlayerProps> = ({
  char,
  mode,
  size = 220,
  blindMode = false,
  onToggleBlindMode,
  onQuizComplete,
  onMistake
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const writerRef = useRef<HanziWriter | null>(null);

  const [speed, setSpeed] = useState(1);
  const [looping, setLooping] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [localBlind, setLocalBlind] = useState(blindMode);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mistakeAlert, setMistakeAlert] = useState<string | null>(null);
  const [completedInfo, setCompletedInfo] = useState<{ mistakes: number } | null>(null);

  const effectiveBlind = onToggleBlindMode ? blindMode : localBlind;

  useEffect(() => {
    setLocalBlind(blindMode);
  }, [blindMode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !char) return;
    host.innerHTML = '';
    setErrorMsg(null);
    setMistakeAlert(null);
    setCompletedInfo(null);

    const isDark = document.documentElement.classList.contains('dark');
    let cancelled = false;

    const writer = HanziWriter.create(host, char, {
      width: size,
      height: size,
      padding: 12,
      strokeAnimationSpeed: speed,
      delayBetweenStrokes: Math.round(350 / speed),
      strokeColor: isDark ? '#f8fafc' : '#0f172a',
      radicalColor: '#e11d48',
      outlineColor: isDark ? '#334155' : '#cbd5e1',
      drawingColor: isDark ? '#fb7185' : '#be123c',
      drawingWidth: 16,
      highlightColor: '#f59e0b',
      showOutline: mode === 'animate' ? true : !effectiveBlind,
      showCharacter: mode === 'animate',
      showHintAfterMisses: 2,
      highlightOnComplete: true,
      charDataLoader: (c, onLoad, onError) => {
        loadHanziWriterCharData(c)
          .then((data) => {
            if (!cancelled) onLoad(data);
          })
          .catch((err) => {
            if (!cancelled) {
              setErrorMsg(err instanceof Error ? err.message : 'Không tải được dữ liệu nét chữ');
              onError?.(err);
            }
          });
      }
    });

    writerRef.current = writer;

    if (mode === 'quiz') {
      writer.quiz({
        showHintAfterMisses: 2,
        onMistake: (strokeData) => {
          setMistakeAlert(
            `Sai thứ tự hoặc ngược chiều nét thứ ${strokeData.strokeNum + 1}!` +
              (strokeData.mistakesOnStroke >= 2 ? ' (Đã bật gợi ý nét)' : '')
          );
          onMistake?.({
            strokeNum: strokeData.strokeNum,
            mistakesOnStroke: strokeData.mistakesOnStroke
          });
        },
        onCorrectStroke: () => {
          setMistakeAlert(null);
        },
        onComplete: (summary) => {
          setMistakeAlert(null);
          setCompletedInfo({ mistakes: summary.totalMistakes });
          onQuizComplete?.({ totalMistakes: summary.totalMistakes });
        }
      });
    } else if (looping) {
      writer.loopCharacterAnimation();
    }

    return () => {
      cancelled = true;
      writerRef.current = null;
      host.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, mode, size, effectiveBlind, speed]);

  const handleAnimate = () => {
    setLooping(false);
    writerRef.current?.animateCharacter();
  };

  const handleLoop = () => {
    const next = !looping;
    setLooping(next);
    if (next) {
      writerRef.current?.loopCharacterAnimation();
    } else {
      writerRef.current?.pauseAnimation();
      writerRef.current?.showCharacter();
    }
  };

  const handleResetQuiz = () => {
    setCompletedInfo(null);
    setMistakeAlert(null);
    writerRef.current?.quiz({
      showHintAfterMisses: 2,
      onMistake: (strokeData) => {
        setMistakeAlert(
          `Sai thứ tự hoặc ngược chiều nét thứ ${strokeData.strokeNum + 1}!` +
            (strokeData.mistakesOnStroke >= 2 ? ' (Đã bật gợi ý nét)' : '')
        );
      },
      onCorrectStroke: () => setMistakeAlert(null),
      onComplete: (summary) => {
        setMistakeAlert(null);
        setCompletedInfo({ mistakes: summary.totalMistakes });
        onQuizComplete?.({ totalMistakes: summary.totalMistakes });
      }
    });
  };

  const toggleBlind = (val: boolean) => {
    if (onToggleBlindMode) onToggleBlindMode(val);
    else setLocalBlind(val);
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-inner overflow-hidden touch-none select-none ${
          showGrid ? 'mi-grid' : ''
        }`}
        style={{ width: size + 8, height: size + 8 }}
      >
        <div ref={hostRef} className="w-full h-full flex items-center justify-center" />
        {errorMsg && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 dark:bg-slate-900/95 p-4 text-center">
            <span className="font-kaiti text-6xl text-slate-800 dark:text-slate-100 mb-2">
              {char}
            </span>
            <p className="text-xs text-amber-600 dark:text-amber-400">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Cảnh báo lỗi viết nét đỏ ngay lập tức */}
      {mode === 'quiz' && mistakeAlert && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{mistakeAlert}</span>
        </div>
      )}

      {mode === 'quiz' && completedInfo && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            Xuất sắc! Hoàn thành chữ "{char}" ({completedInfo.mistakes} lần sai nét)
          </span>
        </div>
      )}

      {/* Điều khiển hoạt ảnh hoặc luyện viết */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {mode === 'animate' ? (
          <>
            <button
              type="button"
              onClick={handleAnimate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Xem thứ tự nét</span>
            </button>
            <button
              type="button"
              onClick={handleLoop}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                looping
                  ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/50 dark:border-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>{looping ? 'Đang lặp' : 'Lặp lại'}</span>
            </button>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              aria-label="Tốc độ viết nét"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold"
            >
              <option value={0.6}>0.6x Chậm</option>
              <option value={1}>1.0x Chuẩn</option>
              <option value={1.6}>1.6x Nhanh</option>
            </select>
            <button
              type="button"
              onClick={() => setShowGrid((g) => !g)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {showGrid ? 'Ẩn lưới' : 'Hiện lưới'}
            </button>
          </>
        ) : (
          <>
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => toggleBlind(false)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  !effectiveBlind
                    ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Tô nét (bóng mờ)</span>
              </button>
              <button
                type="button"
                onClick={() => toggleBlind(true)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  effectiveBlind
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Viết mù</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleResetQuiz}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Viết lại</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
