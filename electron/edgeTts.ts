import crypto from 'node:crypto';
import WebSocket from 'ws';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH_OFFSET = 11644473600;

export interface EdgeTtsOptions {
  text: string;
  voice?: string;
  rate?: number; // 0.6 to 1.2
  pitch?: string;
}

function generateSecMsGec(): string {
  const unixSec = Math.floor(Date.now() / 1000);
  let ticks = unixSec + WIN_EPOCH_OFFSET;
  ticks -= ticks % 300;
  const ticks100ns = BigInt(ticks) * 10_000_000n;
  const input = `${ticks100ns.toString()}${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash('sha256').update(input, 'ascii').digest('hex').toUpperCase();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRatePercent(rate: number): string {
  const clamped = Math.max(0.5, Math.min(1.5, rate));
  const pct = Math.round((clamped - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

/**
 * Chia văn bản dài thành các đoạn ngắn <= 160 ký tự theo dấu câu để HTTP TTS đọc mượt trọn câu.
 */
function splitTextForHttpTts(text: string, maxLen = 160): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return [cleaned];

  const parts = cleaned.split(/(?<=[。！？；，,.!?;])/);
  const chunks: string[] = [];
  let buf = '';
  for (const p of parts) {
    if (!p) continue;
    if ((buf + p).length <= maxLen) {
      buf += p;
    } else {
      if (buf) chunks.push(buf.trim());
      if (p.length > maxLen) {
        for (let i = 0; i < p.length; i += maxLen) {
          chunks.push(p.slice(i, i + maxLen));
        }
        buf = '';
      } else {
        buf = p;
      }
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.filter(Boolean);
}

/**
 * Tầng 1: Microsoft Edge Neural TTS qua WebSocket (giọng tự nhiên cao cấp, timeout nhanh 5s).
 */
async function tryEdgeWebSocketTts(options: EdgeTtsOptions): Promise<Buffer> {
  const text = options.text.trim();
  const voice = options.voice || 'zh-CN-XiaoxiaoNeural';
  const rateStr = formatRatePercent(options.rate ?? 1.0);
  const pitch = options.pitch || '+0Hz';
  const requestId = crypto.randomBytes(16).toString('hex');
  const muid = crypto.randomBytes(16).toString('hex').toUpperCase();
  const secMsGec = generateSecMsGec();

  const url =
    `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
    `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${secMsGec}` +
    `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}` +
    `&ConnectionId=${requestId}`;

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          ws.close();
        } catch {
          // ignore
        }
        reject(new Error('Edge WS timeout'));
      }
    }, 5500);

    const ws = new WebSocket(url, {
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'User-Agent':
          `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ` +
          `(KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0`,
        Cookie: `muid=${muid};`
      }
    });

    ws.on('open', () => {
      // Chuẩn timestamp RFC 1123 (KHÔNG thêm ký tự 'Z' sau GMT!)
      const timestamp = new Date().toUTCString();
      const configMsg =
        `X-Timestamp:${timestamp}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: 'false',
                  wordBoundaryEnabled: 'false'
                },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
              }
            }
          }
        });

      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>` +
        `<voice name='${voice}'>` +
        `<prosody pitch='${pitch}' rate='${rateStr}' volume='+0%'>${escapeXml(text)}</prosody>` +
        `</voice></speak>`;

      const ssmlMsg =
        `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${timestamp}\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml;

      ws.send(configMsg);
      ws.send(ssmlMsg);
    });

    ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
      if (!isBinary) {
        const str = data.toString('utf8');
        if (str.includes('Path:turn.end')) {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            ws.close();
            if (chunks.length === 0) {
              reject(new Error('Edge WS empty audio'));
            } else {
              resolve(Buffer.concat(chunks));
            }
          }
        }
        return;
      }

      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      if (buf.length < 2) return;
      const headerLen = buf.readUInt16BE(0);
      const audioStart = 2 + headerLen;
      if (audioStart < buf.length) {
        const header = buf.subarray(2, audioStart).toString('utf8');
        if (header.includes('Path:audio')) {
          chunks.push(buf.subarray(audioStart));
        }
      }
    });

    ws.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    ws.on('close', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        if (chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error('Edge WS closed early'));
        }
      }
    });
  });
}

async function fetchHttpMp3(url: string, timeoutMs = 6000): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        Referer: 'https://translate.google.com/'
      },
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const arr = await res.arrayBuffer();
    const buf = Buffer.from(arr);
    if (buf.length < 128) {
      throw new Error('Audio payload too small');
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tầng 2 (Dự phòng 0đ siêu bền): Tải trực tiếp MP3 tiếng Trung chuẩn từ Google Translate TTS / Youdao.
 * Đảm bảo 100% máy Windows không cài gói giọng Trung vẫn đọc rõ ràng ngay lập tức!
 */
async function tryHttpChineseTtsFallback(text: string, rate = 1.0): Promise<Buffer> {
  const chunks = splitTextForHttpTts(text, 150);
  const speed = rate <= 0.78 ? '0.6' : '1';
  const buffers: Buffer[] = [];

  for (const chunk of chunks) {
    const encoded = encodeURIComponent(chunk);
    const urls = [
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=zh-CN&ttsspeed=${speed}&q=${encoded}`,
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=zh-CN&q=${encoded}`,
      `https://dict.youdao.com/dictvoice?audio=${encoded}&le=zh`
    ];

    let chunkBuf: Buffer | null = null;
    for (const url of urls) {
      try {
        chunkBuf = await fetchHttpMp3(url);
        break;
      } catch {
        // Thử nguồn dự phòng tiếp theo
      }
    }
    if (!chunkBuf) {
      throw new Error('Không thể tải âm thanh tiếng Trung từ máy chủ TTS');
    }
    buffers.push(chunkBuf);
  }

  return Buffer.concat(buffers);
}

/**
 * Pipeline phát âm 0đ cho Electron Main Process:
 * 1. Thử Microsoft Edge Neural TTS (giọng Xiaoxiao/Yunxi chuẩn Bắc Kinh)
 * 2. Tự động chuyển sang HTTP MP3 TTS (Google Translate / Youdao) nếu Edge chặn token
 */
export async function synthesizeEdgeTts(options: EdgeTtsOptions): Promise<Buffer> {
  const text = options.text.trim();
  if (!text) {
    throw new Error('Nội dung đọc TTS không được để trống');
  }

  try {
    return await tryEdgeWebSocketTts(options);
  } catch {
    return await tryHttpChineseTtsFallback(text, options.rate ?? 1.0);
  }
}
