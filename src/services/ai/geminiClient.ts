import {
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type GenerateContentConfig,
  type Part
} from '@google/genai';
import type { z } from 'zod';
import { db } from '@/db/database';
import { useAppStore } from '@/stores/useAppStore';
import { hashString } from '@/utils/pinyin';

export const RECOMMENDED_PRIMARY_MODEL = 'gemini-3.6-flash';
export const RECOMMENDED_LITE_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_MODEL_CHAIN = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];

export class GeminiError extends Error {
  code:
    | 'NO_KEY'
    | 'OFFLINE'
    | 'RATE_LIMIT'
    | 'INVALID_KEY'
    | 'PARSE_ERROR'
    | 'TIMEOUT'
    | 'ABORTED'
    | 'API_ERROR';
  constructor(code: GeminiError['code'], message: string) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
  }
}

/**
 * Giữ lại RequestQueue để tương thích các test cũ & dùng nhẹ khi cần.
 */
export class RequestQueue {
  private chain: Promise<unknown> = Promise.resolve();
  private lastRunAt = 0;
  private readonly minIntervalMs: number;

  constructor(minIntervalMs = 250) {
    this.minIntervalMs = minIntervalMs;
  }

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const now = Date.now();
      const waitMs = Math.max(0, this.minIntervalMs - (now - this.lastRunAt));
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
      this.lastRunAt = Date.now();
      return task();
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => {});
    return next;
  }
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  const firstBrace = trimmed.search(/[{[]/);
  if (firstBrace > 0) {
    return trimmed.slice(firstBrace);
  }
  return trimmed;
}

function classifyApiError(err: unknown): {
  isRateLimit: boolean;
  isModelUnavailable: boolean;
  isInvalidKey: boolean;
  isBadConfig: boolean;
  isTimeout: boolean;
  isAborted: boolean;
  message: string;
} {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  const isAborted =
    (err instanceof DOMException && err.name === 'AbortError') ||
    lower.includes('aborted') ||
    lower.includes('user_cancelled');
  const isTimeout = lower.includes('timeout') || lower.includes('hết thời gian');
  const isRateLimit =
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit');
  const isModelUnavailable =
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('not supported for generatecontent') ||
    lower.includes('deprecated');
  const isInvalidKey =
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('permission_denied');
  const isBadConfig =
    lower.includes('400') ||
    lower.includes('invalid_argument') ||
    lower.includes('thinking') ||
    lower.includes('temperature');

  return {
    isRateLimit,
    isModelUnavailable,
    isInvalidKey,
    isBadConfig,
    isTimeout,
    isAborted,
    message: msg
  };
}

function createTimeoutController(
  timeoutMs: number,
  externalSignal?: AbortSignal
): {
  signal: AbortSignal;
  isTimedOut: () => boolean;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => {
    controller.abort(new Error('USER_CANCELLED'));
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(new Error('USER_CANCELLED'));
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort(new Error(`Timeout after ${timeoutMs}ms`));
  }, timeoutMs);

  return {
    signal: controller.signal,
    isTimedOut: () => timedOut,
    cleanup: () => {
      globalThis.clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  };
}

/**
 * Xây dựng GenerateContentConfig tương thích 100% giữa Gemini 3 (không nhận temperature, dùng thinkingLevel MINIMAL để siêu nhanh)
 * và Gemini 2.5 (dùng thinkingBudget: 0).
 */
function buildModelConfig(
  model: string,
  opts: {
    systemInstruction?: string;
    responseMimeType?: string;
    temperature?: number;
    maxOutputTokens?: number;
    abortSignal?: AbortSignal;
    omitThinking?: boolean;
    thinkingSpeed?: 'minimal' | 'low';
  }
): GenerateContentConfig {
  const config: GenerateContentConfig = {};
  if (opts.systemInstruction) config.systemInstruction = opts.systemInstruction;
  if (opts.responseMimeType) config.responseMimeType = opts.responseMimeType;
  if (opts.maxOutputTokens) config.maxOutputTokens = opts.maxOutputTokens;
  if (opts.abortSignal) config.abortSignal = opts.abortSignal;

  const lower = model.toLowerCase();
  if (lower.includes('gemini-3')) {
    // Gemini 3 bỏ temperature -> tuyệt đối không gửi để tránh lỗi 400!
    if (!opts.omitThinking) {
      config.thinkingConfig = {
        thinkingLevel:
          opts.thinkingSpeed === 'low' ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL
      };
    }
  } else if (lower.includes('gemini-2.5')) {
    if (!opts.omitThinking) {
      config.thinkingConfig = { thinkingBudget: 0 };
    }
    if (opts.temperature !== undefined) config.temperature = opts.temperature;
  } else {
    if (opts.temperature !== undefined) config.temperature = opts.temperature;
  }
  return config;
}

function buildOrderedModelChain(tier: 'primary' | 'lite'): string[] {
  const { settings } = useAppStore.getState();
  const preferred =
    tier === 'lite'
      ? settings.geminiLiteModel || RECOMMENDED_LITE_MODEL
      : settings.geminiPrimaryModel || RECOMMENDED_PRIMARY_MODEL;
  const secondary =
    tier === 'lite'
      ? settings.geminiPrimaryModel || RECOMMENDED_PRIMARY_MODEL
      : settings.geminiLiteModel || RECOMMENDED_LITE_MODEL;

  const liveModels = (settings.availableModels || []).filter((m) => m.includes('flash'));

  return Array.from(
    new Set([
      preferred,
      secondary,
      ...liveModels.slice(0, 3),
      ...FALLBACK_MODEL_CHAIN
    ])
  ).slice(0, 4);
}

export interface GeminiStructuredCallOptions<T> {
  taskType: string;
  cacheKey?: string;
  bypassCache?: boolean;
  tier?: 'primary' | 'lite';
  systemInstruction?: string;
  prompt: string;
  parts?: Part[];
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  temperature?: number;
  timeoutMs?: number;
}

export interface GeminiCallResult<T> {
  data: T;
  fromCache: boolean;
  modelUsed: string;
}

/**
 * Gọi Google Gemini API trả về JSON cấu trúc (BYOK):
 * - Tra cứu cache IndexedDB trước (0ms, chạy cả khi Offline)
 * - Tương thích chuẩn Gemini 3 (không gửi temperature, thinkingLevel MINIMAL siêu nhanh)
 * - Timeout rõ ràng bằng AbortController (không bao giờ treo xoay vòng mãi!)
 * - Tự động lưu cache vĩnh viễn vào IndexedDB
 */
export async function callGeminiStructured<T>(
  opts: GeminiStructuredCallOptions<T>
): Promise<GeminiCallResult<T>> {
  const fullCacheKey = opts.cacheKey
    ? `${opts.taskType}:${hashString(opts.cacheKey)}`
    : undefined;

  // 1. Tra cứu aiCache trước (chạy 0ms cả khi mất mạng!)
  if (fullCacheKey && !opts.bypassCache) {
    const cached = await db.aiCache.get(fullCacheKey);
    if (cached) {
      try {
        const parsed = opts.schema.safeParse(JSON.parse(cached.payloadJson));
        if (parsed.success) {
          return { data: parsed.data, fromCache: true, modelUsed: cached.model };
        }
      } catch {
        // Cache malformed -> regenerate
      }
    }
  }

  // 2. Kiểm tra điều kiện Online & API Key
  const store = useAppStore.getState();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new GeminiError(
      'OFFLINE',
      'Thiết bị đang Offline (chấm vàng). Chỉ xem được các kết quả AI đã lưu cache trước đó.'
    );
  }
  const apiKey = store.settings.geminiApiKey.trim();
  if (!apiKey) {
    throw new GeminiError(
      'NO_KEY',
      'Chưa nhập Google Gemini API Key miễn phí. Hãy vào Cài đặt để dán key từ Google AI Studio.'
    );
  }

  const modelChain = buildOrderedModelChain(opts.tier || 'primary');
  const ai = new GoogleGenAI({ apiKey });
  const perAttemptTimeout = opts.timeoutMs ?? (opts.parts && opts.parts.length > 0 ? 32000 : 22000);

  let lastError: unknown = null;

  for (const model of modelChain) {
    let omitThinking = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const tc = createTimeoutController(perAttemptTimeout);
      try {
        const contents: Part[] = [{ text: opts.prompt }, ...(opts.parts || [])];
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: contents }],
          config: buildModelConfig(model, {
            systemInstruction: opts.systemInstruction,
            responseMimeType: 'application/json',
            temperature: opts.temperature ?? 0.35,
            abortSignal: tc.signal,
            omitThinking,
            thinkingSpeed: 'minimal'
          })
        });
        tc.cleanup();

        const rawText = response.text;
        if (!rawText) {
          throw new GeminiError('PARSE_ERROR', 'AI trả về nội dung rỗng.');
        }

        const jsonStr = extractJsonText(rawText);
        const rawObj = JSON.parse(jsonStr);
        const validated = opts.schema.safeParse(rawObj);
        if (!validated.success) {
          throw new GeminiError(
            'PARSE_ERROR',
            `Dữ liệu AI chưa đúng cấu trúc (${validated.error.issues[0]?.message || 'schema'}).`
          );
        }

        // Cập nhật trạng thái Online chắc chắn khi gọi thành công!
        if (!useAppStore.getState().isOnline) {
          useAppStore.getState().setOnline(true);
        }
        await store.incrementAiCallCount();

        if (fullCacheKey) {
          await db.aiCache.put({
            cacheKey: fullCacheKey,
            type: opts.taskType,
            model,
            payloadJson: JSON.stringify(validated.data),
            createdAt: Date.now()
          });
        }

        return {
          data: validated.data,
          fromCache: false,
          modelUsed: model
        };
      } catch (err) {
        const timedOut = tc.isTimedOut();
        tc.cleanup();
        lastError = timedOut
          ? new GeminiError('TIMEOUT', `Model ${model} phản hồi quá lâu (> ${Math.round(perAttemptTimeout / 1000)}s).`)
          : err;

        if (timedOut) {
          // Chuyển sang model nhanh hơn tiếp theo ngay lập tức
          break;
        }
        if (err instanceof GeminiError && err.code === 'PARSE_ERROR') {
          if (attempt === 0) continue;
          break;
        }

        const info = classifyApiError(err);
        if (info.isInvalidKey) {
          throw new GeminiError(
            'INVALID_KEY',
            'Gemini API Key không hợp lệ hoặc đã bị thu hồi. Hãy kiểm tra lại trong Cài đặt.'
          );
        }
        if (info.isModelUnavailable) {
          break; // Nhảy ngay sang model kế tiếp
        }
        if (info.isBadConfig && !omitThinking && attempt === 0) {
          omitThinking = true;
          continue; // Thử lại 1 lần bỏ thinkingConfig
        }
        if (info.isRateLimit) {
          break; // Nhảy sang model dự phòng khác ngay thay vì chờ lâu
        }
        break;
      }
    }
  }

  const finalInfo = classifyApiError(lastError);
  if (finalInfo.isRateLimit) {
    throw new GeminiError(
      'RATE_LIMIT',
      'API Key miễn phí đang tạm chạm giới hạn lượt gọi/phút (429). Vui lòng đợi 20–30 giây hoặc đổi sang model Lite trong Cài đặt.'
    );
  }
  if (lastError instanceof GeminiError) throw lastError;
  throw new GeminiError(
    'API_ERROR',
    `Không thể nhận phản hồi từ Gemini AI: ${finalInfo.message}`
  );
}

export interface GeminiStreamChatOptions {
  systemInstruction: string;
  history: Array<{
    role: 'user' | 'model';
    text: string;
    parts?: Part[];
  }>;
  userMessage: string;
  userParts?: Part[];
  tier?: 'primary' | 'lite';
  onChunk: (fullText: string, delta: string) => void;
  signal?: AbortSignal;
}

/**
 * Chat Streaming siêu mượt cho Gia sư AI tự do song ngữ (Việt / Trung):
 * - Hiện từng chữ ngay sau 1–2 giây
 * - Hỗ trợ đính kèm ảnh bài tập & hủy giữa chừng bằng AbortSignal
 */
export async function streamGeminiChat(
  opts: GeminiStreamChatOptions
): Promise<{ text: string; modelUsed: string }> {
  const store = useAppStore.getState();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new GeminiError(
      'OFFLINE',
      'Thiết bị đang Offline (chấm vàng). Hãy kết nối mạng để trò chuyện với Gia sư AI.'
    );
  }
  const apiKey = store.settings.geminiApiKey.trim();
  if (!apiKey) {
    throw new GeminiError(
      'NO_KEY',
      'Chưa nhập Google Gemini API Key miễn phí. Hãy vào Cài đặt để dán key.'
    );
  }

  const modelChain = buildOrderedModelChain(opts.tier || 'primary');
  const ai = new GoogleGenAI({ apiKey });

  const contents: Content[] = [
    ...opts.history.slice(-14).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }, ...(m.parts || [])]
    })),
    {
      role: 'user',
      parts: [{ text: opts.userMessage }, ...(opts.userParts || [])]
    }
  ];

  let lastError: unknown = null;

  for (const model of modelChain) {
    let omitThinking = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const tc = createTimeoutController(38000, opts.signal);
      let fullText = '';
      try {
        const stream = await ai.models.generateContentStream({
          model,
          contents,
          config: buildModelConfig(model, {
            systemInstruction: opts.systemInstruction,
            abortSignal: tc.signal,
            omitThinking,
            thinkingSpeed: 'minimal'
          })
        });

        for await (const chunk of stream) {
          const delta = chunk.text || '';
          if (delta) {
            fullText += delta;
            opts.onChunk(fullText, delta);
          }
        }
        tc.cleanup();

        if (!fullText.trim()) {
          throw new GeminiError('API_ERROR', 'Gia sư AI không trả về nội dung.');
        }

        if (!useAppStore.getState().isOnline) {
          useAppStore.getState().setOnline(true);
        }
        await store.incrementAiCallCount();
        return { text: fullText.trim(), modelUsed: model };
      } catch (err) {
        const timedOut = tc.isTimedOut();
        tc.cleanup();
        if (opts.signal?.aborted) {
          if (fullText.trim()) {
            return { text: fullText.trim(), modelUsed: model };
          }
          throw new GeminiError('ABORTED', 'Đã dừng phản hồi của Gia sư AI.');
        }
        if (fullText.trim()) {
          // Đã có phần nội dung stream ra rồi -> giữ lại cho người dùng
          return { text: fullText.trim(), modelUsed: model };
        }
        lastError = timedOut
          ? new GeminiError('TIMEOUT', `Model ${model} phản hồi chậm, đang chuyển model nhanh hơn...`)
          : err;

        const info = classifyApiError(err);
        if (info.isInvalidKey) {
          throw new GeminiError(
            'INVALID_KEY',
            'Gemini API Key không hợp lệ. Vui lòng kiểm tra lại trong Cài đặt.'
          );
        }
        if (info.isBadConfig && !omitThinking && attempt === 0) {
          omitThinking = true;
          continue;
        }
        break;
      }
    }
  }

  const finalInfo = classifyApiError(lastError);
  if (finalInfo.isRateLimit) {
    throw new GeminiError(
      'RATE_LIMIT',
      'API Key đang tạm quá tải (429). Vui lòng đợi 20 giây rồi gửi lại.'
    );
  }
  if (lastError instanceof GeminiError) throw lastError;
  throw new GeminiError('API_ERROR', `Lỗi kết nối Gia sư AI: ${finalInfo.message}`);
}

/**
 * Tải danh sách model mới nhất trực tiếp từ Google AI Studio ứng với API Key của người dùng (timeout nhanh 8s).
 */
export async function fetchAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const key = apiKey.trim();
  if (!key) {
    throw new GeminiError('NO_KEY', 'Vui lòng nhập API Key trước khi tải danh sách model.');
  }

  const tc = createTimeoutController(8000);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`;
    const res = await fetch(url, { signal: tc.signal });
    tc.cleanup();

    if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new GeminiError('INVALID_KEY', 'API Key không hợp lệ hoặc không có quyền truy cập.');
      }
      throw new GeminiError('API_ERROR', `Lỗi tải danh sách model (HTTP ${res.status}).`);
    }
    const json = (await res.json()) as {
      models?: Array<{
        name?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    const names = (json.models || [])
      .filter(
        (m) =>
          m.name &&
          m.name.includes('gemini') &&
          !m.name.includes('embedding') &&
          !m.name.includes('imagen') &&
          !m.name.includes('veo') &&
          !m.name.includes('tts') &&
          !m.name.includes('audio') &&
          !m.name.includes('robotics') &&
          (m.supportedGenerationMethods || []).includes('generateContent')
      )
      .map((m) => (m.name || '').replace(/^models\//, ''));

    // Ưu tiên dòng Flash & Flash-Lite mới nhất, tốc độ phản hồi cao lên đầu
    const unique = Array.from(new Set(names));
    unique.sort((a, b) => {
      const score = (id: string) => {
        let s = 0;
        if (id.includes('3.8')) s += 75;
        else if (id.includes('3.6')) s += 72;
        else if (id.includes('3.5')) s += 70;
        else if (id.includes('3.')) s += 62;
        else if (id.includes('2.5')) s += 50;
        else if (id.includes('2.0')) s += 25;
        if (id.includes('flash-lite')) s += 16;
        else if (id.includes('flash')) s += 14;
        if (id.includes('latest')) s += 4;
        if (id.includes('pro')) s -= 6;
        if (id.includes('exp') || id.includes('preview')) s -= 4;
        return s;
      };
      return score(b) - score(a);
    });

    return unique.length > 0 ? unique : FALLBACK_MODEL_CHAIN;
  } catch (err) {
    const timedOut = tc.isTimedOut();
    tc.cleanup();
    if (timedOut) {
      throw new GeminiError('TIMEOUT', 'Hết thời gian kết nối tới Google AI Studio (8s). Kiểm tra lại mạng.');
    }
    if (err instanceof GeminiError) throw err;
    throw new GeminiError('API_ERROR', err instanceof Error ? err.message : 'Lỗi kết nối Google AI Studio');
  }
}

export interface GeminiConnectionTestResult {
  ok: boolean;
  modelUsed: string;
  latencyMs: number;
  message: string;
  availableModels?: string[];
  recommendedPrimary?: string;
  recommendedLite?: string;
}

/**
 * Kiểm tra kết nối API Key siêu nhanh (1–3 giây):
 * 1. Lấy danh sách model thực tế đang bật trên key (~300ms) -> không bao giờ mất 45s thử nhầm model chết!
 * 2. Ping model nhanh nhất bằng `thinkingLevel: MINIMAL` & `maxOutputTokens: 16` với timeout 10s.
 */
export async function testGeminiConnection(
  apiKey: string,
  preferredModel?: string
): Promise<GeminiConnectionTestResult> {
  const key = apiKey.trim();
  if (!key) {
    return {
      ok: false,
      modelUsed: preferredModel || RECOMMENDED_LITE_MODEL,
      latencyMs: 0,
      message: 'Bạn chưa nhập Gemini API Key.'
    };
  }

  const start = performance.now();

  // Bước 1: Lấy danh sách model sống thực tế của key này (vừa xác thực key ngay trong < 1s!)
  let liveModels: string[] = [];
  try {
    liveModels = await fetchAvailableGeminiModels(key);
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      ok: false,
      modelUsed: preferredModel || RECOMMENDED_LITE_MODEL,
      latencyMs,
      message:
        err instanceof Error
          ? err.message
          : 'API Key không hợp lệ hoặc không kết nối được Google AI Studio.'
    };
  }

  const bestLite =
    liveModels.find((m) => m.includes('flash-lite')) ||
    liveModels.find((m) => m.includes('flash')) ||
    liveModels[0] ||
    RECOMMENDED_LITE_MODEL;
  const bestPrimary =
    liveModels.find((m) => m.includes('flash') && !m.includes('lite')) ||
    bestLite;

  // Chỉ thử tối đa 2 model chắc chắn tồn tại trong danh sách sống
  const candidates = Array.from(
    new Set([
      ...(preferredModel && liveModels.includes(preferredModel) ? [preferredModel] : []),
      bestLite,
      bestPrimary
    ])
  ).slice(0, 3);

  const ai = new GoogleGenAI({ apiKey: key });

  for (const m of candidates) {
    let omitThinking = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const tc = createTimeoutController(10000);
      try {
        const res = await ai.models.generateContent({
          model: m,
          contents: 'Reply OK',
          config: buildModelConfig(m, {
            maxOutputTokens: 16,
            abortSignal: tc.signal,
            omitThinking,
            thinkingSpeed: 'minimal'
          })
        });
        tc.cleanup();
        if (res.text) {
          const latencyMs = Math.round(performance.now() - start);
          useAppStore.getState().setOnline(true);
          return {
            ok: true,
            modelUsed: m,
            latencyMs,
            availableModels: liveModels,
            recommendedPrimary: m,
            recommendedLite: bestLite,
            message: `Kết nối siêu tốc tới ${m} (${latencyMs}ms) · Đã đồng bộ ${liveModels.length} model!`
          };
        }
      } catch (err) {
        const timedOut = tc.isTimedOut();
        tc.cleanup();
        if (timedOut) break;
        const info = classifyApiError(err);
        if (info.isInvalidKey) {
          return {
            ok: false,
            modelUsed: m,
            latencyMs: Math.round(performance.now() - start),
            message: 'API Key không hợp lệ. Hãy kiểm tra lại key từ Google AI Studio.'
          };
        }
        if (info.isBadConfig && !omitThinking && attempt === 0) {
          omitThinking = true;
          continue;
        }
        if (info.isRateLimit) {
          // Thử model lite khác trong danh sách
          break;
        }
        break;
      }
    }
  }

  return {
    ok: false,
    modelUsed: candidates[0] || bestLite,
    latencyMs: Math.round(performance.now() - start),
    availableModels: liveModels,
    recommendedPrimary: bestPrimary,
    recommendedLite: bestLite,
    message:
      'Key hợp lệ (đã tải được danh sách model) nhưng các model đang phản hồi chậm/quá tải (429). Hãy chọn model Flash-Lite rồi thử lại sau 15 giây.'
  };
}
