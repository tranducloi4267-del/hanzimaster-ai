import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { db } from '@/db/database';
import { transcribeChineseAudioAI } from '@/services/ai/aiTasks';
import { useAppStore } from '@/stores/useAppStore';
import { isHanziChar } from '@/utils/pinyin';

export type SpeechLang = 'zh-CN' | 'vi-VN';

export interface SttResult {
  transcript: string;
  recognizedPinyin?: string;
  toneTipVi?: string;
  engine: 'capacitor' | 'webspeech' | 'gemini-audio' | 'self-check';
  audioUrl?: string;
}

export interface ShadowingDiffToken {
  char: string;
  status: 'correct' | 'wrong' | 'missing';
  spokenChar?: string;
}

export interface ShadowingEvaluation {
  tokens: ShadowingDiffToken[];
  accuracyPercent: number;
  expectedPinyin: string;
  spokenPinyin: string;
  spokenHanzi: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
  }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionInstance;
}

function getWebSpeechCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SpeechRecognitionCtor | null;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      const idx = dataUrl.indexOf(',');
      resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface ActiveRecordingSession {
  engine: 'capacitor' | 'webspeech' | 'media-recorder';
  stopAndTranscribe: () => Promise<SttResult>;
  cancel: () => void;
}

export interface SpeechSessionOptions {
  lang?: SpeechLang;
  onInterim?: (liveText: string) => void;
}

/**
 * Fallback thu âm bằng MediaRecorder (dùng cho Windows Electron và dự phòng cho Android nếu máy thiếu Google Speech Service).
 * Luôn giữ Mic mở liên tục cho đến khi người dùng bấm tắt lần thứ 2!
 */
async function startMediaRecorderSession(lang: SpeechLang): Promise<ActiveRecordingSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Thiết bị không hỗ trợ thu âm Micro.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const actualMime = recorder.mimeType || mimeType || 'audio/webm';
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(250);

  const stopTracks = () => stream.getTracks().forEach((t) => t.stop());

  return {
    engine: 'media-recorder',
    stopAndTranscribe: () =>
      new Promise<SttResult>((resolve) => {
        recorder.onstop = async () => {
          stopTracks();
          const blob = new Blob(chunks, { type: actualMime });
          const audioUrl = URL.createObjectURL(blob);
          const { settings } = useAppStore.getState();

          if (
            (typeof navigator === 'undefined' || navigator.onLine !== false) &&
            settings.geminiApiKey.trim() &&
            blob.size > 200
          ) {
            try {
              const b64 = await blobToBase64(blob);
              const cleanMime = actualMime.split(';')[0] || 'audio/webm';
              const aiRes = await transcribeChineseAudioAI(b64, cleanMime, lang);
              resolve({
                transcript: aiRes.transcript.trim(),
                recognizedPinyin: aiRes.pinyin,
                toneTipVi: aiRes.toneTipVi,
                engine: 'gemini-audio',
                audioUrl
              });
              return;
            } catch {
              // Rớt mượt xuống self-check playback
            }
          }

          resolve({
            transcript: '',
            engine: 'self-check',
            audioUrl
          });
        };

        try {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          } else {
            stopTracks();
            resolve({ transcript: '', engine: 'self-check' });
          }
        } catch {
          stopTracks();
          resolve({ transcript: '', engine: 'self-check' });
        }
      }),
    cancel: () => {
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // ignore
      }
      stopTracks();
    }
  };
}

/**
 * Bắt đầu phiên Mic theo chuẩn 1 chạm BẬT — 1 chạm TẮT:
 * - Nhấn lần 1: Bật mic và giữ lắng nghe liên tục chờ người dùng nói hết câu (không tự tắt sớm khi ngừng thở!).
 * - Nhấn lần 2: Tắt mic, chốt toàn bộ nội dung vừa nói và trả kết quả.
 * Hỗ trợ cả Tiếng Trung ('zh-CN') lẫn Tiếng Việt ('vi-VN').
 */
export async function startChineseSpeechSession(
  options: SpeechSessionOptions = {}
): Promise<ActiveRecordingSession> {
  const lang: SpeechLang = options.lang || 'zh-CN';
  const onInterim = options.onInterim;
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);

  // Tầng 1: Android / iOS Capacitor Native STT (tự động giữ mic mở cho tới khi bấm tắt lần 2; tự fallback sang MediaRecorder nếu máy thiếu Google Speech Service)
  if (Capacitor.isNativePlatform()) {
    try {
      const avail = await SpeechRecognition.available();
      if (avail.available) {
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== 'granted') {
          throw new Error('Cần cấp quyền Micro trong cài đặt Android để dùng giọng nói.');
        }

        const accumulated: string[] = [];
        let currentPartial = '';
        let userStopped = false;
        let restarting = false;

        const joinAll = () => {
          const parts = [...accumulated, currentPartial].map((s) => s.trim()).filter(Boolean);
          return parts.join(lang === 'zh-CN' ? '' : ' ').trim();
        };

        const partialListener = await SpeechRecognition.addListener('partialResults', (data) => {
          if (data.matches && data.matches.length > 0) {
            currentPartial = data.matches[0];
            onInterim?.(joinAll());
          }
        });

        const startNative = async () => {
          if (userStopped) return;
          try {
            await SpeechRecognition.start({
              language: lang,
              maxResults: 2,
              partialResults: true,
              popup: false
            });
          } catch {
            // Ignore transient restart errors
          }
        };

        const stateListener = await SpeechRecognition.addListener('listeningState', (data) => {
          if (data.status === 'stopped' && !userStopped && !restarting) {
            // Android tự ngắt sau một khoảng im lặng ngắn -> chốt đoạn vừa nói và mở lại nghe tiếp cho tới khi người dùng bấm tắt lần 2!
            if (currentPartial.trim()) {
              accumulated.push(currentPartial.trim());
              currentPartial = '';
              onInterim?.(joinAll());
            }
            restarting = true;
            window.setTimeout(async () => {
              restarting = false;
              if (!userStopped) {
                await startNative();
              }
            }, 220);
          }
        });

        await startNative();

        const cleanupListeners = () => {
          partialListener.remove().catch(() => {});
          stateListener.remove().catch(() => {});
        };

        return {
          engine: 'capacitor',
          stopAndTranscribe: async () => {
            userStopped = true;
            try {
              await SpeechRecognition.stop();
            } catch {
              // ignore
            }
            // Đợi 180ms để Android trả nốt partialResult cuối cùng
            await new Promise((r) => setTimeout(r, 180));
            cleanupListeners();
            return {
              transcript: joinAll(),
              engine: 'capacitor'
            };
          },
          cancel: () => {
            userStopped = true;
            SpeechRecognition.stop().catch(() => {});
            cleanupListeners();
          }
        };
      }
    } catch (err) {
      // Nếu người dùng từ chối quyền Micro -> báo rõ
      if (err instanceof Error && err.message.includes('quyền Micro')) {
        throw err;
      }
      // Máy không có Google SpeechRecognizer -> rớt mượt sang MediaRecorder + Gemini Audio!
    }

    return startMediaRecorderSession(lang);
  }

  // Tầng 2: Trình duyệt Web có hỗ trợ Web Speech API (chế độ continuous: giữ mở đến khi bấm tắt lần 2)
  const WebSpeech = !isElectron ? getWebSpeechCtor() : null;
  if (WebSpeech) {
    return new Promise<ActiveRecordingSession>((resolve, reject) => {
      try {
        const rec = new WebSpeech();
        rec.lang = lang;
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        let finalTranscript = '';
        let interimTranscript = '';
        let userStopped = false;
        let failedNetwork = false;
        let finishResolver: ((val: SttResult) => void) | null = null;

        const combinedText = () =>
          `${finalTranscript}${interimTranscript}`.trim();

        rec.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const chunk = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              finalTranscript += (lang === 'vi-VN' && finalTranscript ? ' ' : '') + chunk;
            } else {
              interim += chunk;
            }
          }
          interimTranscript = interim;
          onInterim?.(combinedText());
        };

        rec.onerror = (e) => {
          if (e.error === 'network' || e.error === 'service-not-allowed' || e.error === 'not-allowed') {
            failedNetwork = true;
            userStopped = true;
          }
        };

        rec.onend = () => {
          if (!userStopped && !failedNetwork) {
            // Tự động nghe tiếp cho tới khi người dùng bấm tắt lần 2
            try {
              rec.start();
              return;
            } catch {
              // fall through
            }
          }
          if (finishResolver) {
            finishResolver({
              transcript: failedNetwork ? '' : combinedText(),
              engine: 'webspeech'
            });
            finishResolver = null;
          }
        };

        rec.start();

        resolve({
          engine: 'webspeech',
          stopAndTranscribe: () =>
            new Promise<SttResult>((res) => {
              userStopped = true;
              finishResolver = res;
              try {
                rec.stop();
              } catch {
                res({ transcript: combinedText(), engine: 'webspeech' });
                finishResolver = null;
              }
              window.setTimeout(() => {
                if (finishResolver) {
                  finishResolver({ transcript: combinedText(), engine: 'webspeech' });
                  finishResolver = null;
                }
              }, 900);
            }),
          cancel: () => {
            userStopped = true;
            try {
              rec.stop();
            } catch {
              // ignore
            }
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // Tầng 3: Windows Electron / Fallback bằng MediaRecorder + Gemini Audio
  return startMediaRecorderSession(lang);
}

/**
 * Thuật toán LCS so khớp từng chữ Hán cho Shadowing Mode:
 * - Xanh ('correct'): chữ phát âm khớp
 * - Đỏ ('wrong'): chữ sai / lệch âm
 * - Vàng ('missing'): chữ bị đọc thiếu
 */
export function computeShadowingDiff(
  expectedText: string,
  spokenText: string
): { tokens: ShadowingDiffToken[]; accuracyPercent: number } {
  const exp = Array.from(expectedText).filter(isHanziChar);
  const spk = Array.from(spokenText).filter(isHanziChar);

  if (exp.length === 0) {
    return { tokens: [], accuracyPercent: 0 };
  }

  const m = exp.length;
  const n = spk.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (exp[i] === spk[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const tokens: ShadowingDiffToken[] = [];
  let i = 0;
  let j = 0;
  let correct = 0;

  while (i < m) {
    if (j < n && exp[i] === spk[j]) {
      tokens.push({ char: exp[i], status: 'correct', spokenChar: spk[j] });
      correct++;
      i++;
      j++;
    } else if (j < n && dp[i + 1][j] >= dp[i][j + 1]) {
      if (i + 1 < m && j + 1 < n && dp[i + 1][j + 1] === dp[i][j]) {
        tokens.push({ char: exp[i], status: 'wrong', spokenChar: spk[j] });
        i++;
        j++;
      } else {
        tokens.push({ char: exp[i], status: 'missing' });
        i++;
      }
    } else if (j < n) {
      if (dp[i][j + 1] === dp[i + 1][j + 1] && i < m) {
        tokens.push({ char: exp[i], status: 'wrong', spokenChar: spk[j] });
        i++;
        j++;
      } else {
        j++;
      }
    } else {
      tokens.push({ char: exp[i], status: 'missing' });
      i++;
    }
  }

  const accuracyPercent = Math.round((correct / m) * 100);
  return { tokens, accuracyPercent };
}

export async function lookupSentencePinyin(hanziText: string): Promise<string> {
  const chars = Array.from(hanziText).filter(isHanziChar);
  const out: string[] = [];
  for (const ch of chars) {
    const found = await db.dictionary.where('simplified').equals(ch).first();
    out.push(found ? found.pinyin.split(/\s+/)[0] : ch);
  }
  return out.join(' ');
}

export async function evaluateShadowing(
  expectedHanzi: string,
  spokenHanzi: string,
  expectedPinyin?: string,
  spokenPinyinHint?: string
): Promise<ShadowingEvaluation> {
  const { tokens, accuracyPercent } = computeShadowingDiff(expectedHanzi, spokenHanzi);
  const expPy = expectedPinyin || (await lookupSentencePinyin(expectedHanzi));
  const spkPy = spokenPinyinHint || (await lookupSentencePinyin(spokenHanzi));

  return {
    tokens,
    accuracyPercent,
    expectedPinyin: expPy,
    spokenPinyin: spkPy,
    spokenHanzi
  };
}
