package com.depositmonitor;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public class MainActivity extends Activity {
    private Store store;
    private EditText urlInput, tokenInput;
    private TextView status, logView;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable refresher = new Runnable() {
        @Override public void run() { refresh(); handler.postDelayed(this, 2000); }
    };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        store = new Store(this);

        int pad = dp(16);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad, pad, pad);

        root.addView(text("입금 모니터", 22, true));
        root.addView(text("카카오뱅크 입금 알림을 서버로 전송합니다.", 14, false));

        status = text("", 15, true);
        status.setPadding(0, dp(12), 0, dp(12));
        root.addView(status);

        root.addView(text("서버 주소 (예: https://example.com)", 13, false));
        urlInput = new EditText(this);
        urlInput.setSingleLine();
        urlInput.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        urlInput.setText(store.serverUrl());
        root.addView(urlInput);

        root.addView(text("API 토큰 (서버의 API_TOKEN)", 13, false));
        tokenInput = new EditText(this);
        tokenInput.setSingleLine();
        tokenInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        tokenInput.setText(store.token());
        root.addView(tokenInput);

        root.addView(button("저장 후 연결 테스트", v -> {
            store.saveSettings(urlInput.getText().toString(), tokenInput.getText().toString());
            status.setText("연결 확인 중…");
            Sender.ping(store, result -> { store.log("연결 테스트: " + result); refresh(); });
            Sender.flush(store);
        }));
        root.addView(button("1) 알림 접근 허용 설정 열기", v ->
            startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))));
        root.addView(button("2) 배터리 최적화 설정 열기 (제외 권장)", v ->
            startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))));

        root.addView(text("최근 로그 (길게 눌러 복사 가능)", 13, false));
        logView = new TextView(this);
        logView.setTextSize(12);
        logView.setTypeface(Typeface.MONOSPACE);
        logView.setTextIsSelectable(true);
        root.addView(logView);

        ScrollView sv = new ScrollView(this);
        sv.addView(root);
        setContentView(sv);
    }

    @Override protected void onResume() { super.onResume(); handler.post(refresher); }
    @Override protected void onPause() { super.onPause(); handler.removeCallbacks(refresher); }

    private void refresh() {
        boolean enabled = isListenerEnabled();
        String url = store.serverUrl();
        String warn = url.startsWith("http://") ? "\n⚠ http:// 는 토큰이 암호화되지 않습니다. 가능하면 https 사용" : "";
        status.setText((enabled ? "알림 접근: 켜짐 ✅" : "알림 접근: 꺼짐 ❌ (아래 1번에서 허용)")
                + "\n전송 대기: " + store.queueSize() + "건" + warn);
        String log = store.logText();
        logView.setText(log.isEmpty() ? "아직 로그가 없습니다." : log);
    }

    private boolean isListenerEnabled() {
        String flat = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        if (flat == null) return false;
        String me = new ComponentName(this, NotifListener.class).flattenToString();
        return flat.contains(me);
    }

    private TextView text(String s, int sp, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private Button button(String label, View.OnClickListener l) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setAllCaps(false);
        btn.setOnClickListener(l);
        return btn;
    }

    private int dp(int v) { return (int) (v * getResources().getDisplayMetrics().density); }
}
