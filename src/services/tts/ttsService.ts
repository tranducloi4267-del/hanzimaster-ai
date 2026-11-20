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

async function playAudioBlob(blob: Blob): Promise<void> {
  stopSpeaking();
  return new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    currentObjectUrl = url;
    const audio = new Audio(url);
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
      reject(new Error('Không thể phát tệp âm thanh'));
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

async function fetchEdgeTtsBlob(
  text: string,
  voice: string,
  rate: number,
  proxyUrl?: string
): Promise<Blob | null> {
  // 1. Electron Desktop: Main Process IPC trực tiếp (0đ, 0 server)
  if (typeof window !== 'undefined' && window.electronAPI?.synthesizeEdgeTts) {
    const b64 = await window.electronAPI.synthesizeEdgeTts({ text, voice, rate });
    return base64ToBlob(b64, 'audio/mpeg');
  }

  // 2. Android Capacitor Native Plugin (OkHttp WebSocket trực tiếp 0đ)
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    try {
      const res = await EdgeTtsNative.synthesize({ text, voice, rate });
      if (res?.audioBase64) {
        return base64ToBlob(res.audioBase64, 'audio/mpeg');
      }
    } catch {
      // Fall through to proxy or native TTS
    }
  }

  // 3. Tùy chọn Proxy URL do người dùng tự cấu hình (hoặc Vite dev middleware khi chạy local)
  const endpoint = proxyUrl?.trim() || (import.meta.env.DEV ? '/api/edge-tts' : '');
  if (endpoint) {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate })
    });
    if (resp.ok) {
      const blob = await resp.blob();
      if (blob.size > 0) return blob;
    }
  }

  return null;
}

async function speakWithFallbackNativeOrWeb(text: string, rate: number): Promise<void> {
  stopSpeaking();

  // Android/iOS Native TTS (hoạt động cả offline!)
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

  // Web Speech API fallback
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    await new Promise<void>((resolve, reject) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = Math.max(0.6, Math.min(1.3, rate));
      const voices = window.speechSynthesis.getVoices();
      const zhVoice =
        voices.find((v) => v.lang.toLowerCase() === 'zh-cn' && v.name.includes('Microsoft')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('zh-cn')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('zh'));
      if (zhVoice) utter.voice = zhVoice;
      utter.onend = () => resolve();
      utter.onerror = (e) => reject(new Error(e.error || 'Lỗi Web Speech TTS'));
      window.speechSynthesis.speak(utter);
    });
    return;
  }

  throw new Error('Thiết bị không hỗ trợ phát âm TTS');
}

export interface SpeakOptions {
  voice?: string;
  rate?: number;
  forceNative?: boolean;
}

/**
 * Phát âm tiếng Trung ưu tiên 0đ đa tầng:
 * Audio Cache IndexedDB -> Microsoft Edge TTS (Online) -> Native / Web Speech API (Offline fallback).
 */
export async function speakChinese(
  rawText: string,
  options: SpeakOptions = {}
): Promise<'cache' | 'edge' | 'native'> {
  const text = rawText.trim();
  if (!text) return 'native';

  const { settings, isOnline } = useAppStore.getState();
  const voice = options.voice || settings.ttsVoice || 'zh-CN-XiaoxiaoNeural';
  const rate = options.rate ?? settings.ttsRate ?? 0.95;
  const textHash = hashString(`${text}|${voice}|${rate.toFixed(2)}`);

  // 1. Luôn kiểm tra audioCache IndexedDB trước (chạy 0ms cả khi offline)
  if (!options.forceNative) {
    try {
      const cached = await db.audioCache.get(textHash);
      if (cached && cached.audioBlob && cached.audioBlob.size > 0) {
        await db.audioCache.update(textHash, { lastAccessedAt: Date.now() });
        await playAudioBlob(cached.audioBlob);
        return 'cache';
      }
    } catch {
      // Proceed to synthesize
    }
  }

  // 2. Nếu Online, thử Microsoft Edge TTS và lưu cache LRU vào IndexedDB
  if (isOnline && !options.forceNative) {
    try {
      const blob = await fetchEdgeTtsBlob(text, voice, rate, settings.ttsProxyUrl);
      if (blob && blob.size > 0) {
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
        await playAudioBlob(blob);
        return 'edge';
      }
    } catch {
      // Fallback smoothly below
    }
  }

  // 3. Fallback mượt sang Capacitor Native TTS / Web Speech API
  await speakWithFallbackNativeOrWeb(text, rate);
  return 'native';
}

export async function clearAudioCache(): Promise<number> {
  const count = await db.audioCache.count();
  await db.audioCache.clear();
  return count;
}
