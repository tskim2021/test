package com.depositmonitor;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** 설정, 전송 대기열, 화면에 보여줄 로그를 SharedPreferences에 보관한다. */
final class Store {
    static final String KAKAOBANK_PACKAGE = "com.kakaobank.channel";
    private static final int MAX_QUEUE = 200;
    private static final int MAX_LOG_LINES = 40;

    private final SharedPreferences p;

    Store(Context c) {
        p = c.getApplicationContext().getSharedPreferences("deposit-monitor", Context.MODE_PRIVATE);
    }

    String serverUrl() { return p.getString("url", ""); }
    String token() { return p.getString("token", ""); }

    void saveSettings(String url, String token) {
        String u = url.trim();
        while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        p.edit().putString("url", u).putString("token", token.trim()).apply();
    }

    // ---- 푸시 설정/진행 상태 ----
    void setLastPush() { p.edit().putLong("last_push_at", System.currentTimeMillis()).apply(); }
    long lastPushAt() { return p.getLong("last_push_at", 0); }
    void setPushState(String text) { p.edit().putString("push_state", text).putLong("push_state_at", System.currentTimeMillis()).apply(); }
    String pushState() { return p.getString("push_state", "서비스 꺼짐"); }
    long pushStateAt() { return p.getLong("push_state_at", 0); }
    boolean pushEnabled() { return p.getBoolean("push", true); }
    void setPushEnabled(boolean on) { p.edit().putBoolean("push", on).apply(); }
    boolean baselineDone() { return p.getBoolean("baseline", false); }
    long lastDepositId() { return p.getLong("last_deposit_id", 0); }
    String lastProcessedAt() { return p.getString("last_processed_at", "1970-01-01T00:00:00.000Z"); }

    synchronized void setBaseline(long depositId, String nowIso) {
        p.edit().putBoolean("baseline", true).putLong("last_deposit_id", depositId)
                .putString("last_processed_at", nowIso.isEmpty() ? lastProcessedAt() : nowIso).apply();
    }
    /** id 가 마지막으로 알린 것보다 크면 갱신하고 true(= 새로 알려야 함). */
    synchronized boolean advanceDeposit(long id) {
        if (id <= lastDepositId()) return false;
        p.edit().putLong("last_deposit_id", id).apply();
        return true;
    }
    synchronized boolean advanceProcessed(String atIso) {
        if (atIso == null || atIso.isEmpty() || atIso.compareTo(lastProcessedAt()) <= 0) return false;
        p.edit().putString("last_processed_at", atIso).apply();
        return true;
    }

    synchronized void enqueue(String title, String text) {
        try {
            JSONArray q = new JSONArray(p.getString("queue", "[]"));
            JSONArray out = new JSONArray();
            int start = Math.max(0, q.length() - (MAX_QUEUE - 1));
            for (int i = start; i < q.length(); i++) out.put(q.get(i));
            out.put(new JSONObject().put("title", title).put("text", text));
            p.edit().putString("queue", out.toString()).apply();
        } catch (Exception ignored) { }
    }

    synchronized JSONObject peek() {
        try {
            JSONArray q = new JSONArray(p.getString("queue", "[]"));
            return q.length() == 0 ? null : q.getJSONObject(0);
        } catch (Exception e) { return null; }
    }

    synchronized void pop() {
        try {
            JSONArray q = new JSONArray(p.getString("queue", "[]"));
            JSONArray out = new JSONArray();
            for (int i = 1; i < q.length(); i++) out.put(q.get(i));
            p.edit().putString("queue", out.toString()).apply();
        } catch (Exception ignored) { }
    }

    synchronized int queueSize() {
        try { return new JSONArray(p.getString("queue", "[]")).length(); } catch (Exception e) { return 0; }
    }

    synchronized void log(String line) {
        String stamp = new SimpleDateFormat("MM-dd HH:mm:ss", Locale.KOREA).format(new Date());
        String[] old = p.getString("log", "").split("\n");
        StringBuilder sb = new StringBuilder(stamp + "  " + line);
        for (int i = 0; i < old.length && i < MAX_LOG_LINES - 1; i++) {
            if (!old[i].isEmpty()) sb.append('\n').append(old[i]);
        }
        p.edit().putString("log", sb.toString()).apply();
    }

    String logText() { return p.getString("log", ""); }
}
