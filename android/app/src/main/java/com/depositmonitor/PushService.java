package com.depositmonitor;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * 서버(/events, SSE)와 실시간으로 연결을 유지하며 '처리 필요'(새 입금)와 '처리 완료' 알림을 띄운다.
 * Firebase 없이 동작하는 대신 상태 표시줄에 연결 상태 알림이 계속 떠 있다(포그라운드 서비스).
 */
public class PushService extends Service {
    private static final int FG_ID = 1;
    private volatile boolean running;
    private volatile HttpURLConnection conn;
    private Thread worker;

    public static void start(Context c) { c.startForegroundService(new Intent(c, PushService.class)); }
    public static void stop(Context c) { c.stopService(new Intent(c, PushService.class)); }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notifier.ensureChannels(this);
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(FG_ID, Notifier.status(this, "연결 중…"), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(FG_ID, Notifier.status(this, "연결 중…"));
        }
        if (worker == null || !worker.isAlive()) {
            running = true;
            worker = new Thread(this::loop, "push");
            worker.start();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        new Store(this).setPushState("서비스 꺼짐");
        running = false;
        HttpURLConnection c = conn;
        if (c != null) c.disconnect();
        if (worker != null) worker.interrupt();
        super.onDestroy();
    }

    private void status(String text) {
        new Store(this).setPushState(text);
        getSystemService(android.app.NotificationManager.class).notify(FG_ID, Notifier.status(this, text));
    }

    private void loop() {
        long backoff = 2000;
        while (running) {
            Store store = new Store(this);
            String base = store.serverUrl(), token = store.token();
            try {
                if (base.isEmpty() || token.isEmpty()) {
                    status("서버 주소/토큰을 설정하세요");
                    Thread.sleep(10_000);
                    continue;
                }
                catchUp(store, base, token);
                status("실시간 연결됨");
                backoff = 2000;
                stream(store, base, token);
                if (running) status("연결이 끊겼어요 · 재연결 중…");
            } catch (InterruptedException e) {
                return;
            } catch (Exception e) {
                if (running) status("연결 실패 · 재연결 중…");
            }
            try { Thread.sleep(backoff); } catch (InterruptedException e) { return; }
            backoff = Math.min(backoff * 2, 30_000);
        }
    }

    private HttpURLConnection open(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(10_000);
        c.setReadTimeout(70_000); // 서버가 25초마다 ping 을 보내므로 그 안에 아무것도 없으면 끊긴 것
        return c;
    }

    private static String enc(String s) throws Exception { return URLEncoder.encode(s, "UTF-8"); }

    private String readAll(InputStream in) throws Exception {
        try (BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder(); String l;
            while ((l = r.readLine()) != null) sb.append(l);
            return sb.toString();
        }
    }

    /** 연결이 끊긴 사이의 알림을 따라잡는다. 처음 실행이면 지금까지의 내역은 알리지 않고 기준점만 잡는다. */
    private void catchUp(Store store, String base, String token) throws Exception {
        String url = base + "/api/push/since?token=" + enc(token);
        boolean first = !store.baselineDone();
        if (!first) url += "&deposit=" + store.lastDepositId() + "&processed=" + enc(store.lastProcessedAt());
        HttpURLConnection c = open(url);
        try {
            if (c.getResponseCode() == 401) { status("토큰이 올바르지 않습니다"); Thread.sleep(15_000); throw new Exception("401"); }
            JSONObject r = new JSONObject(readAll(c.getInputStream()));
            if (first) {
                store.setBaseline(r.optLong("max_id"), r.optString("now"));
                return;
            }
            JSONArray deps = r.optJSONArray("deposits");
            JSONArray procs = r.optJSONArray("processed");
            if (deps != null) {
                if (deps.length() > 5) {
                    Notifier.summary(this, deps.length());
                } else {
                    for (int i = 0; i < deps.length(); i++) Notifier.needs(this, deps.getJSONObject(i));
                }
                for (int i = 0; i < deps.length(); i++) store.advanceDeposit(deps.getJSONObject(i).optLong("id"));
            }
            if (procs != null) {
                for (int i = 0; i < procs.length(); i++) {
                    JSONObject p = procs.getJSONObject(i);
                    Notifier.done(this, p);
                    store.advanceProcessed(p.optString("at"));
                }
            }
        } finally {
            c.disconnect();
        }
    }

    private void stream(Store store, String base, String token) throws Exception {
        HttpURLConnection c = open(base + "/events?token=" + enc(token));
        c.setRequestProperty("Accept", "text/event-stream");
        conn = c;
        try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8))) {
            SseParser parser = new SseParser();
            String line;
            while (running && (line = r.readLine()) != null) {
                SseParser.Event e = parser.feed(line);
                if (e != null) handle(store, e);
            }
        } finally {
            c.disconnect();
            conn = null;
        }
    }

    private void handle(Store store, SseParser.Event e) {
        try {
            JSONObject d = new JSONObject(e.data);
            if (e.name.equals("test")) {
                Notifier.test(this, d);
            } else if (e.name.equals("deposit")) {
                if (!store.advanceDeposit(d.optLong("id"))) return; // 이미 알린 입금
                Notifier.needs(this, d);
            } else if (e.name.equals("processed")) {
                if (!store.advanceProcessed(d.optString("at"))) return;
                Notifier.done(this, d);
            }
        } catch (Exception ignored) { }
    }
}
