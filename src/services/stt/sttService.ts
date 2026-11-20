import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { db } from '@/db/database';
import { transcribeChineseAudioAI } from '@/services/ai/aiTasks';
import { useAppStore } from '@/stores/useAppStore';
import { isHanziChar } from '@/utils/pinyin';

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

interface SpeechRecognitionCtor {
  new (): {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
  };
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

/**
 * Bắt đầu thu âm / nhận diện giọng nói tiếng Trung (zh-CN) theo kiến trúc STT 3 tầng:
 * 1. Android Native (@capacitor-community/speech-recognition)
 * 2. Web Browser (Web Speech API)
 * 3. Windows Electron hoặc fallback (MediaRecorder -> Gemini Audio nếu Online + có Key, hoặc Self-Check phát lại khi Offline)
 */
export async function startChineseSpeechSession(): Promise<ActiveRecordingSession> {
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);

  // Tầng 1: Android / iOS Capacitor Native STT
  if (Capacitor.isNativePlatform()) {
    const perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== 'granted') {
      throw new Error('Cần cấp quyền Micro để nhận diện giọng nói tiếng Trung.');
    }
    let lastTranscript = '';
    const listener = await SpeechRecognition.addListener('partialResults', (data) => {
      if (data.matches && data.matches.length > 0) {
        lastTranscript = data.matches[0];
      }
    });

    await SpeechRecognition.start({
      language: 'zh-CN',
      maxResults: 2,
      partialResults: true,
      popup: false
    });

    return {
      engine: 'capacitor',
      stopAndTranscribe: async () => {
        try {
          await SpeechRecognition.stop();
        } finally {
          listener.remove();
        }
        return {
          transcript: lastTranscript.trim(),
          engine: 'capacitor'
        };
      },
      cancel: () => {
        SpeechRecognition.stop().catch(() => {});
        listener.remove();
      }
    };
  }

  // Tầng 2: Trình duyệt Web có hỗ trợ Web Speech API (không dùng trong Electron vì lỗi network)
  const WebSpeech = !isElectron ? getWebSpeechCtor() : null;
  if (WebSpeech) {
    return new Promise<ActiveRecordingSession>((resolve, reject) => {
      try {
        const rec = new WebSpeech();
        rec.lang = 'zh-CN';
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        let transcript = '';
        let failedNetwork = false;
        let finishResolver: ((val: SttResult) => void) | null = null;

        rec.onresult = (event) => {
          let combined = '';
          for (let i = 0; i < event.results.length; i++) {
            combined += event.results[i][0]?.transcript || '';
          }
          transcript = combined.trim();
        };

        rec.onerror = (e) => {
          if (e.error === 'network' || e.error === 'service-not-allowed') {
            failedNetwork = true;
          }
        };

        rec.onend = () => {
          if (finishResolver) {
            finishResolver({
              transcript: failedNetwork ? '' : transcript,
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
              finishResolver = res;
              try {
                rec.stop();
              } catch {
                res({ transcript, engine: 'webspeech' });
              }
              window.setTimeout(() => {
                if (finishResolver) {
                  finishResolver({ transcript, engine: 'webspeech' });
                  finishResolver = null;
                }
              }, 1200);
            }),
          cancel: () => {
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

  // Tầng 3: Windows Electron / Fallback bằng MediaRecorder
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Thiết bị không hỗ trợ thu âm Micro.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();

  const stopTracks = () => stream.getTracks().forEach((t) => t.stop());

  return {
    engine: 'media-recorder',
    stopAndTranscribe: () =>
      new Promise<SttResult>((resolve) => {
        recorder.onstop = async () => {
          stopTracks();
          const blob = new Blob(chunks, { type: mimeType });
          const audioUrl = URL.createObjectURL(blob);
          const { isOnline, settings } = useAppStore.getState();

          if (isOnline && settings.geminiApiKey.trim()) {
            try {
              const b64 = await blobToBase64(blob);
              const cleanMime = mimeType.split(';')[0];
              const aiRes = await transcribeChineseAudioAI(b64, cleanMime);
              resolve({
                transcript: aiRes.transcript,
                recognizedPinyin: aiRes.pinyin,
                toneTipVi: aiRes.toneTipVi,
                engine: 'gemini-audio',
                audioUrl
              });
              return;
            } catch {
              // Fall back cleanly to self-check playback
            }
          }

          resolve({
            transcript: '',
            engine: 'self-check',
            audioUrl
          });
        };
        recorder.stop();
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

  // LCS DP table
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
      // Check whether spk[j] looks like a substitution for exp[i]
      if (i + 1 < m && j + 1 < n && dp[i + 1][j + 1] === dp[i][j]) {
        tokens.push({ char: exp[i], status: 'wrong', spokenChar: spk[j] });
        i++;
        j++;
      } else {
        tokens.push({ char: exp[i], status: 'missing' });
        i++;
      }
    } else if (j < n) {
      // Extra spoken char; consume spoken char and check alignment
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
