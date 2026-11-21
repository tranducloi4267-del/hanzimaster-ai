package com.hanzimaster.ai;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

@CapacitorPlugin(name = "EdgeTts")
public class EdgeTtsPlugin extends Plugin {
    private static final String TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    private static final String SEC_MS_GEC_VERSION = "1-143.0.3650.75";
    private static final long WIN_EPOCH_OFFSET = 11644473600L;

    private final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(6, TimeUnit.SECONDS)
            .readTimeout(8, TimeUnit.SECONDS)
            .writeTimeout(6, TimeUnit.SECONDS)
            .build();

    private final ExecutorService executor = Executors.newCachedThreadPool();

    private static String randomHex(int byteLen) {
        byte[] bytes = new byte[byteLen];
        new SecureRandom().nextBytes(bytes);
        StringBuilder sb = new StringBuilder(byteLen * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private static String generateSecMsGec() throws Exception {
        long unixSec = System.currentTimeMillis() / 1000L;
        long ticks = unixSec + WIN_EPOCH_OFFSET;
        ticks -= (ticks % 300L);
        long ticks100ns = ticks * 10_000_000L;
        String input = ticks100ns + TRUSTED_CLIENT_TOKEN;
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(input.getBytes(StandardCharsets.US_ASCII));
        StringBuilder sb = new StringBuilder(hash.length * 2);
        for (byte b : hash) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    private static String escapeXml(String str) {
        return str.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static List<String> splitChunks(String text, int maxLen) {
        String cleaned = text.replaceAll("\\s+", " ").trim();
        List<String> result = new ArrayList<>();
        if (cleaned.length() <= maxLen) {
            result.add(cleaned);
            return result;
        }
        StringBuilder buf = new StringBuilder();
        for (int i = 0; i < cleaned.length(); i++) {
            char ch = cleaned.charAt(i);
            buf.append(ch);
            boolean isBreak = (ch == '。' || ch == '！' || ch == '？' || ch == '；' || ch == '，'
                    || ch == '.' || ch == '!' || ch == '?' || ch == ';');
            if ((isBreak && buf.length() >= maxLen / 2) || buf.length() >= maxLen) {
                String piece = buf.toString().trim();
                if (!piece.isEmpty()) result.add(piece);
                buf.setLength(0);
            }
        }
        String tail = buf.toString().trim();
        if (!tail.isEmpty()) result.add(tail);
        return result;
    }

    private byte[] tryEdgeWebSocket(String text, String voice, double rate) throws Exception {
        int pct = (int) Math.round((Math.max(0.5, Math.min(1.5, rate)) - 1.0) * 100.0);
        String rateStr = (pct >= 0 ? "+" : "") + pct + "%";
        String requestId = randomHex(16);
        String muid = randomHex(16).toUpperCase(Locale.US);
        String secMsGec = generateSecMsGec();

        String url = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"
                + "?TrustedClientToken=" + TRUSTED_CLIENT_TOKEN
                + "&Sec-MS-GEC=" + secMsGec
                + "&Sec-MS-GEC-Version=" + SEC_MS_GEC_VERSION
                + "&ConnectionId=" + requestId;

        Request request = new Request.Builder()
                .url(url)
                .addHeader("Pragma", "no-cache")
                .addHeader("Cache-Control", "no-cache")
                .addHeader("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
                .addHeader("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                .addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0")
                .addHeader("Cookie", "muid=" + muid + ";")
                .build();

        ByteArrayOutputStream audioOut = new ByteArrayOutputStream();
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<Throwable> errRef = new AtomicReference<>();

        SimpleDateFormat sdf = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss 'GMT'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("GMT"));
        String timestamp = sdf.format(new Date());

        WebSocket ws = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                String configMsg = "X-Timestamp:" + timestamp + "\r\n"
                        + "Content-Type:application/json; charset=utf-8\r\n"
                        + "Path:speech.config\r\n\r\n"
                        + "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"},\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}";

                String ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>"
                        + "<voice name='" + voice + "'>"
                        + "<prosody pitch='+0Hz' rate='" + rateStr + "' volume='+0%'>"
                        + escapeXml(text)
                        + "</prosody></voice></speak>";

                String ssmlMsg = "X-RequestId:" + requestId + "\r\n"
                        + "Content-Type:application/ssml+xml\r\n"
                        + "X-Timestamp:" + timestamp + "\r\n"
                        + "Path:ssml\r\n\r\n"
                        + ssml;

                webSocket.send(configMsg);
                webSocket.send(ssmlMsg);
            }

            @Override
            public void onMessage(WebSocket webSocket, String message) {
                if (message.contains("Path:turn.end")) {
                    webSocket.close(1000, "Done");
                    latch.countDown();
                }
            }

            @Override
            public void onMessage(WebSocket webSocket, ByteString bytes) {
                byte[] arr = bytes.toByteArray();
                if (arr.length < 2) return;
                int headerLen = ((arr[0] & 0xFF) << 8) | (arr[1] & 0xFF);
                int audioStart = 2 + headerLen;
                if (audioStart < arr.length) {
                    String header = new String(arr, 2, headerLen, StandardCharsets.UTF_8);
                    if (header.contains("Path:audio")) {
                        synchronized (audioOut) {
                            audioOut.write(arr, audioStart, arr.length - audioStart);
                        }
                    }
                }
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                errRef.set(t);
                latch.countDown();
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                latch.countDown();
            }
        });

        boolean completed = latch.await(5500, TimeUnit.MILLISECONDS);
        if (!completed) {
            ws.cancel();
            throw new Exception("Edge WS timeout");
        }
        byte[] data;
        synchronized (audioOut) {
            data = audioOut.toByteArray();
        }
        if (data.length < 128) {
            Throwable err = errRef.get();
            throw new Exception(err != null ? err.getMessage() : "Empty Edge WS audio");
        }
        return data;
    }

    private byte[] fetchUrlBytes(String url) throws Exception {
        Request req = new Request.Builder()
                .url(url)
                .addHeader("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36")
                .addHeader("Referer", "https://translate.google.com/")
                .build();
        try (Response resp = client.newCall(req).execute()) {
            if (!resp.isSuccessful()) {
                throw new Exception("HTTP " + resp.code());
            }
            ResponseBody body = resp.body();
            if (body == null) throw new Exception("Empty body");
            byte[] bytes = body.bytes();
            if (bytes.length < 128) throw new Exception("Audio too short");
            return bytes;
        }
    }

    private byte[] tryHttpFallback(String text, double rate) throws Exception {
        List<String> chunks = splitChunks(text, 140);
        String speed = rate <= 0.78 ? "0.6" : "1";
        ByteArrayOutputStream combined = new ByteArrayOutputStream();

        for (String chunk : chunks) {
            String encoded = URLEncoder.encode(chunk, "UTF-8").replace("+", "%20");
            String[] urls = new String[]{
                    "https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=zh-CN&ttsspeed=" + speed + "&q=" + encoded,
                    "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=zh-CN&q=" + encoded,
                    "https://dict.youdao.com/dictvoice?audio=" + encoded + "&le=zh"
            };
            byte[] piece = null;
            for (String u : urls) {
                try {
                    piece = fetchUrlBytes(u);
                    break;
                } catch (Exception ignored) {
                    // Try next fallback mirror
                }
            }
            if (piece == null) {
                throw new Exception("HTTP TTS fallback failed");
            }
            combined.write(piece);
        }

        byte[] out = combined.toByteArray();
        if (out.length < 128) {
            throw new Exception("Empty HTTP TTS output");
        }
        return out;
    }

    @PluginMethod
    public void synthesize(PluginCall call) {
        String text = call.getString("text", "").trim();
        if (text.isEmpty()) {
            call.reject("Text must not be empty");
            return;
        }
        String voice = call.getString("voice", "zh-CN-XiaoxiaoNeural");
        double rate = call.getDouble("rate", 1.0);

        executor.execute(() -> {
            try {
                byte[] audioBytes;
                try {
                    audioBytes = tryEdgeWebSocket(text, voice, rate);
                } catch (Exception ignored) {
                    audioBytes = tryHttpFallback(text, rate);
                }
                JSObject ret = new JSObject();
                ret.put("audioBase64", Base64.encodeToString(audioBytes, Base64.NO_WRAP));
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("TTS failed: " + e.getMessage());
            }
        });
    }
}
