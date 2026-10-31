package com.depositmonitor;

import android.app.Notification;
import android.content.ComponentName;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.ArrayList;
import java.util.List;

/** 카카오뱅크 입금을 서버로 전달한다. 기본은 문자 앱 알림(카카오뱅크 입금 문자), 설정에서 카카오뱅크 앱 알림으로 바꿀 수 있다. */
public class NotifListener extends NotificationListenerService {

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String pkg = sbn.getPackageName();
        if (getPackageName().equals(pkg)) return; // 이 앱이 띄운 푸시는 무시
        Store store = new Store(this);
        Bundle extras = sbn.getNotification().extras;
        if (store.smsMode()) {
            if (Store.KAKAOBANK_PACKAGE.equals(pkg)) return;
            onSms(store, sbn, extras);
            return;
        }
        if (!Store.KAKAOBANK_PACKAGE.equals(pkg)) return;

        String title = str(extras.getCharSequence(Notification.EXTRA_TITLE));
        String text = str(extras.getCharSequence(Notification.EXTRA_TEXT));
        String big = str(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (!big.isEmpty()) text = big;
        if (title.isEmpty() && text.isEmpty()) return;

        store.log("카카오뱅크 알림 수신: [" + title + "] " + text);
        Sender.submit(this, title, text);
    }

    // 문자 앱 알림: 메시지가 여러 개 묶여 있으면 하나씩 꺼내서 본다.
    private void onSms(Store store, StatusBarNotification sbn, Bundle extras) {
        List<String> texts = new ArrayList<>();
        List<Long> times = new ArrayList<>();
        Parcelable[] msgs = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (msgs != null) {
            for (Parcelable p : msgs) {
                if (!(p instanceof Bundle)) continue;
                Bundle b = (Bundle) p;
                texts.add(str(b.getCharSequence("text")));
                times.add(b.getLong("time", sbn.getPostTime()));
            }
        }
        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null) for (CharSequence l : lines) { texts.add(str(l)); times.add(sbn.getPostTime()); }
        texts.add(str(extras.getCharSequence(Notification.EXTRA_BIG_TEXT))); times.add(sbn.getPostTime());
        texts.add(str(extras.getCharSequence(Notification.EXTRA_TEXT))); times.add(sbn.getPostTime());

        for (String t : SmsPick.pick(texts, times, System.currentTimeMillis())) {
            if (!store.markSent(SmsPick.key(t))) continue; // 이미 보낸 문자(직접 수신 경로와 겹쳐도 한 번만)
            store.log("카카오뱅크 문자 수신: " + t);
            Sender.submit(this, "", t);
        }
    }

    @Override
    public void onListenerConnected() {
        // 알림 접근이 켜져 있으면 시스템이 이 서비스를 계속 살려 두고 다시 붙여 주므로, 이때 푸시 연결도 함께 되살린다.
        Store s = new Store(this);
        if (s.pushEnabled() && !s.serverUrl().isEmpty() && !s.token().isEmpty()) {
            try { PushService.start(this); } catch (Exception ignored) { }
        }
    }

    @Override
    public void onListenerDisconnected() {
        // 시스템이 연결을 끊었을 때 다시 붙는다.
        requestRebind(new ComponentName(this, NotifListener.class));
    }

    private static String str(CharSequence s) { return s == null ? "" : s.toString(); }
}
