import { GoogleGenAI, type Part } from '@google/genai';
import type { z } from 'zod';
import { db } from '@/db/database';
import { useAppStore } from '@/stores/useAppStore';
import { hashString } from '@/utils/pinyin';

export const RECOMMENDED_PRIMARY_MODEL = 'gemini-3.8-flash';
export const RECOMMENDED_LITE_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_MODEL_CHAIN = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash'
];

export class GeminiError extends Error {
  code: 'NO_KEY' | 'OFFLINE' | 'RATE_LIMIT' | 'INVALID_KEY' | 'PARSE_ERROR' | 'API_ERROR';
  constructor(
    code: GeminiError['code'],
    message: string
  ) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
  }
}

/**
 * Hàng đợi kiểm soát tốc độ gọi Gemini Free Tier chống lỗi 429 Too Many Requests.
 */
export class RequestQueue {
  private chain: Promise<unknown> = Promise.resolve();
  private lastRunAt = 0;
  private readonly minIntervalMs: number;

  constructor(minIntervalMs = 1100) {
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

const aiQueue = new RequestQueue(1100);

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
  message: string;
} {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  const isRateLimit =
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit');
  const isModelUnavailable =
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('not supported') ||
    lower.includes('deprecated');
  const isInvalidKey =
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('permission_denied');
  return { isRateLimit, isModelUnavailable, isInvalidKey, message: msg };
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
}

export interface GeminiCallResult<T> {
  data: T;
  fromCache: boolean;
  modelUsed: string;
}

/**
 * Gọi Google Gemini API (BYOK) với đầy đủ:
 * 1. Tra cứu bộ nhớ đệm IndexedDB (`aiCache`) trước mọi lời gọi.
 * 2. Kiểm tra trạng thái Online & API Key thân thiện tiếng Việt.
 * 3. Đưa qua RequestQueue chống spam + Exponential Backoff + Tự động Fallback chuỗi model khi 429/404.
 * 4. Ép `responseMimeType: "application/json"` + xác thực an toàn qua Zod Schema.
 * 5. Lưu vĩnh viễn kết quả vào IndexedDB (`aiCache`) để dùng offline mãi mãi.
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

  // 2. Kiểm tra điều kiện Online & Key
  const store = useAppStore.getState();
  if (!store.isOnline) {
    throw new GeminiError(
      'OFFLINE',
      'Thiết bị đang Offline. Chỉ có thể xem các kết quả AI đã được lưu cache trước đó.'
    );
  }
  const apiKey = store.settings.geminiApiKey.trim();
  if (!apiKey) {
    throw new GeminiError(
      'NO_KEY',
      'Chưa nhập Google Gemini API Key miễn phí. Hãy vào Cài đặt để dán key từ Google AI Studio.'
    );
  }

  const preferred =
    opts.tier === 'lite'
      ? store.settings.geminiLiteModel || RECOMMENDED_LITE_MODEL
      : store.settings.geminiPrimaryModel || RECOMMENDED_PRIMARY_MODEL;

  const modelChain = Array.from(
    new Set([
      preferred,
      ...(opts.tier === 'lite'
        ? [RECOMMENDED_LITE_MODEL, RECOMMENDED_PRIMARY_MODEL, 'gemini-2.5-flash']
        : FALLBACK_MODEL_CHAIN)
    ])
  );

  const ai = new GoogleGenAI({ apiKey });

  return aiQueue.enqueue(async () => {
    let lastError: unknown = null;

    for (const model of modelChain) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const contents: Part[] = [{ text: opts.prompt }, ...(opts.parts || [])];
          const response = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: contents }],
            config: {
              systemInstruction: opts.systemInstruction,
              responseMimeType: 'application/json',
              temperature: opts.temperature ?? 0.35
            }
          });

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
              `Dữ liệu AI trả về chưa khớp định dạng chuẩn (${validated.error.issues[0]?.message || 'schema'}).`
            );
          }

          await store.incrementAiCallCount();

          // Lưu vĩnh viễn vào IndexedDB aiCache
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
          lastError = err;
          if (err instanceof GeminiError && err.code === 'PARSE_ERROR') {
            if (attempt === 0) continue; // retry once on JSON glitch
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
            // Chuyển ngay sang model kế tiếp trong chuỗi fallback
            break;
          }
          if (info.isRateLimit) {
            if (attempt === 0) {
              // Exponential backoff ngắn trước khi chuyển model dự phòng
              await new Promise((r) => setTimeout(r, 1800));
              continue;
            }
            break; // thử model kế tiếp
          }
          // Lỗi mạng tạm thời -> backoff 1 lần
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 1200));
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
        'API Key miễn phí tạm thời chạm giới hạn lượt gọi/phút (429). Vui lòng đợi 30–60 giây rồi thử lại.'
      );
    }
    if (lastError instanceof GeminiError) throw lastError;
    throw new GeminiError(
      'API_ERROR',
      `Không thể kết nối Google Gemini API: ${finalInfo.message}`
    );
  });
}

/**
 * Tải danh sách model mới nhất trực tiếp từ Google AI Studio ứng với API Key của người dùng.
 */
export async function fetchAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const key = apiKey.trim();
  if (!key) {
    throw new GeminiError('NO_KEY', 'Vui lòng nhập API Key trước khi tải danh sách model.');
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`;
  const res = await fetch(url);
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
        (m.supportedGenerationMethods || []).includes('generateContent')
    )
    .map((m) => (m.name || '').replace(/^models\//, ''));

  // Ưu tiên đưa các dòng flash mới nhất lên đầu
  const unique = Array.from(new Set(names));
  unique.sort((a, b) => {
    const score = (id: string) => {
      let s = 0;
      if (id.includes('3.8')) s += 80;
      else if (id.includes('3.6')) s += 70;
      else if (id.includes('3.5')) s += 65;
      else if (id.includes('3.')) s += 55;
      else if (id.includes('2.5')) s += 40;
      else if (id.includes('2.0')) s += 20;
      if (id.includes('flash-lite')) s += 8;
      else if (id.includes('flash')) s += 12;
      if (id.includes('latest')) s += 6;
      if (id.includes('exp') || id.includes('preview')) s -= 3;
      return s;
    };
    return score(b) - score(a);
  });

  return unique.length > 0 ? unique : FALLBACK_MODEL_CHAIN;
}

/**
 * Kiểm tra kết nối API Key và đo độ trễ phản hồi thực tế.
 */
export async function testGeminiConnection(
  apiKey: string,
  model?: string
): Promise<{ ok: boolean; modelUsed: string; latencyMs: number; message: string }> {
  const key = apiKey.trim();
  if (!key) {
    return {
      ok: false,
      modelUsed: model || RECOMMENDED_PRIMARY_MODEL,
      latencyMs: 0,
      message: 'Bạn chưa nhập Gemini API Key.'
    };
  }
  const ai = new GoogleGenAI({ apiKey: key });
  const targetModels = Array.from(
    new Set([model || RECOMMENDED_PRIMARY_MODEL, ...FALLBACK_MODEL_CHAIN])
  );
  const start = performance.now();

  for (const m of targetModels) {
    try {
      const res = await ai.models.generateContent({
        model: m,
        contents: 'Trả lời đúng 1 từ: OK'
      });
      if (res.text) {
        const latencyMs = Math.round(performance.now() - start);
        return {
          ok: true,
          modelUsed: m,
          latencyMs,
          message: `Kết nối thành công tới ${m} (${latencyMs}ms)!`
        };
      }
    } catch (err) {
      const info = classifyApiError(err);
      if (info.isInvalidKey) {
        return {
          ok: false,
          modelUsed: m,
          latencyMs: Math.round(performance.now() - start),
          message: 'API Key không hợp lệ. Hãy kiểm tra lại key từ Google AI Studio.'
        };
      }
      if (info.isModelUnavailable) continue;
      if (info.isRateLimit) {
        return {
          ok: false,
          modelUsed: m,
          latencyMs: Math.round(performance.now() - start),
          message: `Key hợp lệ nhưng model ${m} đang tạm quá tải (429). Hãy thử model khác.`
        };
      }
    }
  }

  return {
    ok: false,
    modelUsed: targetModels[0],
    latencyMs: Math.round(performance.now() - start),
    message: 'Không thể kết nối Google Gemini API. Kiểm tra mạng hoặc chọn model khác.'
  };
}
