import { Capacitor, registerPlugin } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { db } from '@/db/database';
import { useAppStore } from '@/stores/useAppStore';
import { hashString } from '@/utils/pinyin';

interface EdgeTtsNativePlugin {
  synthesize(options: {
    text: string;
    voice: string;
    rate: number;
  }): Promise<{ audioBase64: string }>;
}

const EdgeTtsNative = registerPlugin<EdgeTtsNativePlugin>('EdgeTts');

export interface EdgeVoiceOption {
  id: string;
  label: string;
  gender: 'female' | 'male';
}

export const EDGE_CHINESE_VOICES: EdgeVoiceOption[] = [
  { id: 'zh-CN-XiaoxiaoNeural', label: 'Hiểu Hiểu (Nữ · Chuẩn Bắc Kinh)', gender: 'female' },
  { id: 'zh-CN-YunxiNeural', label: 'Vân Hi (Nam · Tự nhiên, rõ ràng)', gender: 'male' },
  { id: 'zh-CN-XiaoyiNeural', label: 'Hiểu Y (Nữ · Trẻ trung, năng động)', gender: 'female' },
  { id: 'zh-CN-YunjianNeural', label: 'Vân Kiện (Nam · Trầm ấm, tin tức)', gender: 'male' }
];

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

function base64ToBlob(base64: string, mime = 'audio/mpeg'): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function stopSpeaking(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // ignore
    }
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  if (Capacitor.isNativePlatform()) {
    TextToSpeech.stop().catch(() => {});
  }
}

async function playAudioBlob(blob: Blob, playbackRate = 1.0): Promise<void> {
  stopSpeaking();
  return new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    currentObjectUrl = url;
    const audio = new Audio(url);
    audio.playbackRate = Math.max(0.6, Math.min(1.4, playbackRate));
    currentAudio = audio;

    const cleanup = () => {
      if (currentObjectUrl === url) {
        URL.revokeObjectURL(url);
        currentObjectUrl = null;
      }
      if (currentAudio === audio) {
        currentAudio = null;
      }
    };

    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error('Không thể phát tệp âm thanh MP3'));
    };
    audio.play().catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

export async function enforceAudioCacheLRU(maxMB: number): Promise<void> {
  const limitBytes = Math.max(5, maxMB) * 1024 * 1024;
  const all = await db.audioCache.orderBy('lastAccessedAt').toArray();
  let total = all.reduce((sum, item) => sum + (item.sizeBytes || item.audioBlob.size || 0), 0);
  if (total <= limitBytes) return;

  const targetBytes = limitBytes * 0.82;
  const keysToDelete: string[] = [];
  for (const item of all) {
    if (total <= targetBytes) break;
    keysToDelete.push(item.textHash);
    total -= item.sizeBytes || item.audioBlob.size || 0;
  }
  if (keysToDelete.length > 0) {
    await db.audioCache.bulkDelete(keysToDelete);
  }
}

async function fetchOnlineTtsBlob(
  text: string,
  voice: string,
  rate: number,
  proxyUrl?: string
): Promise<Blob | null> {
  // 1. Electron Windows Desktop: Main Process IPC (Edge WS -> tự động dự phòng HTTP MP3 0đ)
  if (typeof window !== 'undefined' && window.electronAPI?.synthesizeEdgeTts) {
    const b64 = await window.electronAPI.synthesizeEdgeTts({ text, voice, rate });
    if (b64) return base64ToBlob(b64, 'audio/mpeg');
  }

  // 2. Android Capacitor Native Plugin (OkHttp Edge WS -> tự động dự phòng HTTP MP3 0đ)
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    const res = await EdgeTtsNative.synthesize({ text, voice, rate });
    if (res?.audioBase64) {
      return base64ToBlob(res.audioBase64, 'audio/mpeg');
    }
  }

  // 3. Proxy URL hoặc Vite dev middleware
  const endpoint = proxyUrl?.trim() || (import.meta.env.DEV ? '/api/edge-tts' : '');
  if (endpoint) {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate })
    });
    if (resp.ok) {
      const blob = await resp.blob();
      if (blob.size > 128) return blob;
    }
  }

  return null;
}

async function getSpeechVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return existing;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 450);
    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timer);
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

async function speakWithFallbackNativeOrWeb(text: string, rate: number): Promise<void> {
  stopSpeaking();

  // Android/iOS Native TTS (hoạt động cả offline nếu máy đã có dữ liệu giọng zh-CN)
  if (Capacitor.isNativePlatform()) {
    await TextToSpeech.speak({
      text,
      lang: 'zh-CN',
      rate: Math.max(0.5, Math.min(1.5, rate)),
      pitch: 1.0,
      volume: 1.0,
      category: 'ambient'
    });
    return;
  }

  // Web Speech API fallback (kiểm tra chắc chắn máy có giọng zh-CN để không im lặng)
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const voices = await getSpeechVoicesAsync();
    const zhVoice =
      voices.find((v) => v.lang.toLowerCase() === 'zh-cn' && v.name.includes('Microsoft')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('zh-cn')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('zh'));

    if (!zhVoice && voices.length > 0) {
      throw new Error(
        'Máy chưa cài gói giọng tiếng Trung Offline. Hãy bật kết nối mạng (chấm xanh Online) để app tự phát âm chuẩn và lưu cache Offline!'
      );
    }

    await new Promise<void>((resolve, reject) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = Math.max(0.6, Math.min(1.3, rate));
      if (zhVoice) utter.voice = zhVoice;

      const guardTimer = window.setTimeout(() => resolve(), Math.max(8000, text.length * 450));
      utter.onend = () => {
        window.clearTimeout(guardTimer);
        resolve();
      };
      utter.onerror = (e) => {
        window.clearTimeout(guardTimer);
        reject(new Error(e.error || 'Lỗi Web Speech TTS'));
      };
      window.speechSynthesis.speak(utter);
    });
    return;
  }

  throw new Error('Thiết bị không hỗ trợ phát âm TTS Offline.');
}

export interface SpeakOptions {
  voice?: string;
  rate?: number;
  forceNative?: boolean;
  silentError?: boolean;
}

/**
 * Phát âm tiếng Trung 0đ đa tầng (chắc chắn có tiếng trên cả Windows .exe & Android .apk):
 * 1. Audio Cache IndexedDB (0ms kể cả khi Offline)
 * 2. Online MP3 0đ qua Electron IPC / Android OkHttp (Edge Neural TTS -> tự động fallback Google/Youdao MP3) + lưu cache LRU
 * 3. Native / Web Speech API (Offline fallback) — báo thông báo rõ nếu máy Offline và thiếu gói giọng Trung.
 */
export async function speakChinese(
  rawText: string,
  options: SpeakOptions = {}
): Promise<'cache' | 'edge' | 'native'> {
  const text = rawText.trim();
  if (!text) return 'native';

  const { settings, pushToast } = useAppStore.getState();
  const voice = options.voice || settings.ttsVoice || 'zh-CN-XiaoxiaoNeural';
  const rate = options.rate ?? settings.ttsRate ?? 0.95;
  const textHash = hashString(`${text}|${voice}|${rate.toFixed(2)}`);

  // 1. Luôn kiểm tra audioCache IndexedDB trước (chạy 0ms cả khi offline)
  if (!options.forceNative) {
    try {
      const cached = await db.audioCache.get(textHash);
      if (cached && cached.audioBlob && cached.audioBlob.size > 128) {
        await db.audioCache.update(textHash, { lastAccessedAt: Date.now() });
        await playAudioBlob(cached.audioBlob, 1.0);
        return 'cache';
      }
    } catch {
      // Proceed to synthesize
    }
  }

  // 2. Luôn thử tầng Online MP3 (kể cả khi trạng thái mạng vừa hồi phục chưa kịp ping lại)
  if (!options.forceNative && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    try {
      const blob = await fetchOnlineTtsBlob(text, voice, rate, settings.ttsProxyUrl);
      if (blob && blob.size > 128) {
        const now = Date.now();
        await db.audioCache.put({
          textHash,
          text,
          voice,
          rate,
          audioBlob: blob,
          sizeBytes: blob.size,
          createdAt: now,
          lastAccessedAt: now
        });
        enforceAudioCacheLRU(settings.maxAudioCacheMB || 50).catch(() => {});
        await playAudioBlob(blob, 1.0);
        return 'edge';
      }
    } catch {
      // Fallback smoothly below
    }
  }

  // 3. Fallback mượt sang Capacitor Native TTS / Web Speech API
  try {
    await speakWithFallbackNativeOrWeb(text, rate);
    return 'native';
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : 'Không thể phát âm khi Offline (thiếu gói giọng tiếng Trung trên máy).';
    if (!options.silentError) {
      pushToast(msg, 'warning');
    }
    throw err;
  }
}

export async function clearAudioCache(): Promise<number> {
  const count = await db.audioCache.count();
  await db.audioCache.clear();
  return count;
}
