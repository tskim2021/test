package com.depositmonitor;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** 대기열의 알림을 서버로 보낸다. 실패하면 대기열에 남겨 두고 30초 뒤 다시 시도한다(오프라인 대비). */
final class Sender {
    private static final ExecutorService EXEC = Executors.newSingleThreadExecutor();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final long RETRY_MS = 30_000;

    static void submit(Context c, String title, String text) {
        final Store store = new Store(c);
        store.enqueue(title, text);
        flush(store);
    }

    static void flush(final Store store) {
        EXEC.execute(() -> {
            String base = store.serverUrl();
            if (base.isEmpty() || store.token().isEmpty()) {
                if (store.queueSize() > 0) store.log("서버 주소/토큰 미설정 - 전송 대기 " + store.queueSize() + "건");
                return;
            }
            JSONObject item;
            while ((item = store.peek()) != null) {
                try {
                    int code = post(base + "/api/notify", store.token(), item.toString());
                    if (code >= 200 && code < 300) {
                        store.pop();
                        store.log("전송 성공: " + item.optString("text"));
                    } else {
                        store.log("전송 실패 HTTP " + code + (code == 401 ? " (토큰 확인)" : "") + " - 30초 후 재시도");
                        scheduleRetry(store);
                        return;
                    }
                } catch (Exception e) {
                    store.log("전송 실패(" + e.getClass().getSimpleName() + ") - 30초 후 재시도, 대기 " + store.queueSize() + "건");
                    scheduleRetry(store);
                    return;
                }
            }
        });
    }

    private static void scheduleRetry(final Store store) {
        MAIN.postDelayed(() -> flush(store), RETRY_MS);
    }

    /** 서버 주소와 토큰이 맞는지 확인(입금 내역은 만들지 않는다). */
    static void ping(final Store store, final Callback cb) {
        EXEC.execute(() -> {
            String result;
            try {
                HttpURLConnection h = open(store.serverUrl() + "/api/ping", store.token());
                h.setRequestMethod("GET");
                int code = h.getResponseCode();
                result = code == 200 ? "연결 성공 ✅" : code == 401 ? "토큰이 틀렸습니다 (HTTP 401)" : "서버 응답 HTTP " + code;
            } catch (Exception e) {
                result = "연결 실패: " + e.getMessage();
            }
            final String r = result;
            MAIN.post(() -> cb.done(r));
        });
    }

    interface Callback { void done(String result); }

    private static HttpURLConnection open(String url, String token) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
        h.setConnectTimeout(10_000);
        h.setReadTimeout(10_000);
        h.setRequestProperty("Authorization", "Bearer " + token);
        return h;
    }

    private static int post(String url, String token, String json) throws Exception {
        HttpURLConnection h = open(url, token);
        h.setRequestMethod("POST");
        h.setDoOutput(true);
        h.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        try (OutputStream os = h.getOutputStream()) {
            os.write(json.getBytes(StandardCharsets.UTF_8));
        }
        int code = h.getResponseCode();
        h.disconnect();
        return code;
    }
}
