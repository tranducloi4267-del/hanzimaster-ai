package com.hanzimaster.ai;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

@CapacitorPlugin(name = "EdgeTts")
public class EdgeTtsPlugin extends Plugin {
    private static final String TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    private static final String SEC_MS_GEC_VERSION = "1-130.0.2849.68";
    private static final long WIN_EPOCH_OFFSET = 11644473600L;

    private final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(12, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .build();

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

    @PluginMethod
    public void synthesize(PluginCall call) {
        String text = call.getString("text", "").trim();
        if (text.isEmpty()) {
            call.reject("Text must not be empty");
            return;
        }
        String voice = call.getString("voice", "zh-CN-XiaoxiaoNeural");
        double rate = call.getDouble("rate", 1.0);
        int pct = (int) Math.round((Math.max(0.5, Math.min(1.5, rate)) - 1.0) * 100.0);
        String rateStr = (pct >= 0 ? "+" : "") + pct + "%";

        try {
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
                    .addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0")
                    .addHeader("Cookie", "muid=" + muid + ";")
                    .build();

            ByteArrayOutputStream audioOut = new ByteArrayOutputStream();
            AtomicBoolean settled = new AtomicBoolean(false);

            SimpleDateFormat sdf = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss 'GMT'", Locale.US);
            sdf.setTimeZone(TimeZone.getTimeZone("GMT"));
            String timestamp = sdf.format(new Date());

            client.newWebSocket(request, new WebSocketListener() {
                @Override
                public void onOpen(WebSocket ws, Response response) {
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
                            + "X-Timestamp:" + timestamp + "Z\r\n"
                            + "Path:ssml\r\n\r\n"
                            + ssml;

                    ws.send(configMsg);
                    ws.send(ssmlMsg);
                }

                @Override
                public void onMessage(WebSocket ws, String message) {
                    if (message.contains("Path:turn.end")) {
                        if (settled.compareAndSet(false, true)) {
                            ws.close(1000, "Done");
                            byte[] bytes = audioOut.toByteArray();
                            if (bytes.length == 0) {
                                call.reject("Empty audio stream");
                            } else {
                                JSObject ret = new JSObject();
                                ret.put("audioBase64", Base64.encodeToString(bytes, Base64.NO_WRAP));
                                call.resolve(ret);
                            }
                        }
                    }
                }

                @Override
                public void onMessage(WebSocket ws, ByteString bytes) {
                    byte[] arr = bytes.toByteArray();
                    if (arr.length < 2) return;
                    int headerLen = ((arr[0] & 0xFF) << 8) | (arr[1] & 0xFF);
                    int audioStart = 2 + headerLen;
                    if (audioStart < arr.length) {
                        String header = new String(arr, 2, headerLen, StandardCharsets.UTF_8);
                        if (header.contains("Path:audio")) {
                            audioOut.write(arr, audioStart, arr.length - audioStart);
                        }
                    }
                }

                @Override
                public void onFailure(WebSocket ws, Throwable t, Response response) {
                    if (settled.compareAndSet(false, true)) {
                        call.reject("Edge TTS error: " + t.getMessage());
                    }
                }

                @Override
                public void onClosed(WebSocket ws, int code, String reason) {
                    if (settled.compareAndSet(false, true)) {
                        byte[] bytes = audioOut.toByteArray();
                        if (bytes.length > 0) {
                            JSObject ret = new JSObject();
                            ret.put("audioBase64", Base64.encodeToString(bytes, Base64.NO_WRAP));
                            call.resolve(ret);
                        } else {
                            call.reject("Edge TTS closed early: " + reason);
                        }
                    }
                }
            });
        } catch (Exception e) {
            call.reject("Edge TTS init failed: " + e.getMessage());
        }
    }
}
