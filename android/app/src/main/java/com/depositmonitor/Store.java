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
