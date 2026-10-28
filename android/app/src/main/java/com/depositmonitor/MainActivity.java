package com.depositmonitor;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.provider.Settings;
import android.text.InputType;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import java.net.URLEncoder;

/** 두 화면: [목록] 서버의 웹 대시보드(리스트·검색·주문 확인) / [설정] 서버 연결, 푸시, 알림 접근. */
public class MainActivity extends Activity {
    private Store store;
    private WebView web;
    private ScrollView settings;
    private EditText urlInput, tokenInput;
    private TextView status, logView;
    private Button tabList, tabSettings;
    private boolean webLoaded;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable refresher = new Runnable() {
        @Override public void run() { refresh(); handler.postDelayed(this, 2000); }
    };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        store = new Store(this);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        tabList = tab("목록", v -> showList(false));
        tabSettings = tab("설정", v -> showSettings());
        Button reload = tab("새로고침", v -> showList(true));
        bar.addView(tabList, weight());
        bar.addView(tabSettings, weight());
        bar.addView(reload, weight());
        root.addView(bar);

        FrameLayout body = new FrameLayout(this);
        web = buildWebView();
        settings = buildSettings();
        body.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        body.addView(settings, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(body, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        if (configured()) showList(false); else showSettings();
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.post(refresher);
        ensurePush();
    }

    @Override protected void onPause() { super.onPause(); handler.removeCallbacks(refresher); }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (configured()) showList(true); // 알림을 눌러 들어오면 최신 목록
    }

    @Override
    public void onBackPressed() {
        if (settings.getVisibility() == View.VISIBLE && configured()) showList(false);
        else if (web.getVisibility() == View.VISIBLE && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    // ---------- 목록(웹) ----------
    private WebView buildWebView() {
        WebView w = new WebView(this);
        WebSettings ws = w.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setSupportMultipleWindows(true);
        ws.setJavaScriptCanOpenWindowsAutomatically(true);
        w.setWebViewClient(new WebViewClient());
        w.setWebChromeClient(new WebChromeClient() {
            // 웹의 alert/confirm/prompt(처리 확인, 메모 등)를 앱 대화상자로 보여 준다. 구현하지 않으면 confirm 이 항상 취소로 처리된다.
            @Override public boolean onJsAlert(WebView v, String url, String msg, JsResult r) {
                new AlertDialog.Builder(MainActivity.this).setMessage(msg)
                        .setPositiveButton("확인", (d, i) -> r.confirm()).setOnCancelListener(d -> r.cancel()).show();
                return true;
            }
            @Override public boolean onJsConfirm(WebView v, String url, String msg, JsResult r) {
                new AlertDialog.Builder(MainActivity.this).setMessage(msg)
                        .setPositiveButton("확인", (d, i) -> r.confirm())
                        .setNegativeButton("취소", (d, i) -> r.cancel()).setOnCancelListener(d -> r.cancel()).show();
                return true;
            }
            @Override public boolean onJsPrompt(WebView v, String url, String msg, String def, JsPromptResult r) {
                EditText in = new EditText(MainActivity.this);
                in.setText(def);
                new AlertDialog.Builder(MainActivity.this).setMessage(msg).setView(in)
                        .setPositiveButton("확인", (d, i) -> r.confirm(in.getText().toString()))
                        .setNegativeButton("취소", (d, i) -> r.cancel()).setOnCancelListener(d -> r.cancel()).show();
                return true;
            }
            // '상품보기' 같은 새 창 링크는 휴대폰 브라우저로 연다.
            @Override public boolean onCreateWindow(WebView v, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView tmp = new WebView(MainActivity.this);
                tmp.setWebViewClient(new WebViewClient() {
                    private void open(WebView view, String url) {
                        if (url != null && url.startsWith("http")) startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                        view.stopLoading();
                        view.destroy();
                    }
                    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) { open(view, req.getUrl().toString()); return true; }
                    @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap f) { open(view, url); }
                });
                ((WebView.WebViewTransport) resultMsg.obj).setWebView(tmp);
                resultMsg.sendToTarget();
                return true;
            }
        });
        return w;
    }

    private boolean configured() { return !store.serverUrl().isEmpty() && !store.token().isEmpty(); }

    private void showList(boolean forceReload) {
        if (!configured()) { showSettings(); return; }
        settings.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
        tabList.setTypeface(null, Typeface.BOLD);
        tabSettings.setTypeface(null, Typeface.NORMAL);
        if (!webLoaded || forceReload) {
            try {
                // 토큰은 주소의 # 뒤에 붙여 보낸다(서버로 전송되지 않고, 웹이 읽어 로그인한다).
                web.loadUrl(store.serverUrl() + "/#token=" + URLEncoder.encode(store.token(), "UTF-8"));
                webLoaded = true;
            } catch (Exception ignored) { }
        }
    }

    private void showSettings() {
        web.setVisibility(View.GONE);
        settings.setVisibility(View.VISIBLE);
        tabList.setTypeface(null, Typeface.NORMAL);
        tabSettings.setTypeface(null, Typeface.BOLD);
    }

    // ---------- 설정 ----------
    private ScrollView buildSettings() {
        int pad = dp(16);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad, pad, pad);

        root.addView(text("입금 모니터", 22, true));
        root.addView(text("카카오뱅크 입금 알림을 서버로 전송하고, 서버의 처리 상황을 푸시로 알려 줍니다.", 14, false));

        status = text("", 15, true);
        status.setPadding(0, dp(12), 0, dp(12));
        root.addView(status);

        root.addView(text("서버 주소 (예: http://129.121.115.247:3100)", 13, false));
        urlInput = new EditText(this);
        urlInput.setSingleLine();
        urlInput.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        urlInput.setText(store.serverUrl());
        root.addView(urlInput);

        root.addView(text("접속 토큰 (서버의 API_TOKEN)", 13, false));
        tokenInput = new EditText(this);
        tokenInput.setSingleLine();
        tokenInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        tokenInput.setText(store.token());
        root.addView(tokenInput);

        root.addView(button("저장 후 연결 테스트", v -> {
            store.saveSettings(urlInput.getText().toString(), tokenInput.getText().toString());
            webLoaded = false;
            status.setText("연결 확인 중…");
            Sender.ping(store, result -> { store.log("연결 테스트: " + result); refresh(); });
            Sender.flush(store);
            ensurePush();
        }));

        Switch push = new Switch(this);
        push.setText("푸시 알림 받기 (처리 필요 / 처리 완료)");
        push.setChecked(store.pushEnabled());
        push.setPadding(0, dp(8), 0, dp(8));
        push.setOnCheckedChangeListener((CompoundButton b, boolean on) -> {
            store.setPushEnabled(on);
            if (on) { ensurePush(); } else { PushService.stop(this); }
            refresh();
        });
        root.addView(push);
        root.addView(text("※ 푸시를 켜면 상태 표시줄에 '실시간 연결됨' 알림이 계속 표시됩니다(연결 유지를 위해 필요).", 12, false));

        root.addView(button("1) 알림 접근 허용 설정 열기 (카카오뱅크 알림 읽기)", v ->
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
        return sv;
    }

    /** 설정돼 있고 켜져 있으면 푸시 서비스를 실행(알림 권한이 없으면 먼저 요청). */
    private void ensurePush() {
        if (!store.pushEnabled() || !configured()) return;
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
            return;
        }
        try { PushService.start(this); } catch (Exception e) { store.log("푸시 시작 실패: " + e.getMessage()); }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) ensurePush();
        else store.log("알림 권한이 거부되어 푸시를 받을 수 없습니다 (폰 설정 > 앱 > 알림에서 허용)");
    }

    private void refresh() {
        if (status == null) return;
        boolean enabled = isListenerEnabled();
        String url = store.serverUrl();
        String warn = url.startsWith("http://") ? "\n⚠ http:// 는 토큰이 암호화되지 않습니다. 가능하면 https 사용" : "";
        status.setText((enabled ? "알림 접근: 켜짐 ✅" : "알림 접근: 꺼짐 ❌ (아래 1번에서 허용)")
                + "\n푸시: " + (store.pushEnabled() ? "켜짐" : "꺼짐")
                + "\n전송 대기: " + store.queueSize() + "건" + warn);
        String log = store.logText();
        logView.setText(log.isEmpty() ? "아직 로그가 없습니다." : log);
    }

    private boolean isListenerEnabled() {
        String flat = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        if (flat == null) return false;
        return flat.contains(new ComponentName(this, NotifListener.class).flattenToString());
    }

    private LinearLayout.LayoutParams weight() { return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f); }

    private Button tab(String label, View.OnClickListener l) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setAllCaps(false);
        btn.setOnClickListener(l);
        return btn;
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
