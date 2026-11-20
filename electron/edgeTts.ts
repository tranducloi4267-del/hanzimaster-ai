import crypto from 'node:crypto';
import WebSocket from 'ws';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '130.0.2849.68';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH_OFFSET = 11644473600;

export interface EdgeTtsOptions {
  text: string;
  voice?: string;
  rate?: number; // 0.6 to 1.2
  pitch?: string;
}

function generateSecMsGec(): string {
  // Windows file time in 100ns intervals, rounded down to 5-minute buckets
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

export async function synthesizeEdgeTts(options: EdgeTtsOptions): Promise<Buffer> {
  const text = options.text.trim();
  if (!text) {
    throw new Error('Nội dung đọc TTS không được để trống');
  }

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
        reject(new Error('Hết thời gian kết nối Microsoft Edge TTS'));
      }
    }, 15000);

    const ws = new WebSocket(url, {
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'User-Agent':
          `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ` +
          `(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0`,
        Cookie: `muid=${muid};`
      }
    });

    ws.on('open', () => {
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
        `X-Timestamp:${timestamp}Z\r\n` +
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
              reject(new Error('Edge TTS không trả về dữ liệu âm thanh'));
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
          reject(new Error('Kết nối Edge TTS bị đóng sớm'));
        }
      }
    });
  });
}
