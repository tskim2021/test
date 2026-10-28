package com.depositmonitor;

import android.app.Notification;
import android.content.ComponentName;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/** 카카오뱅크 앱의 알림만 골라 서버로 전달한다. */
public class NotifListener extends NotificationListenerService {

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (!Store.KAKAOBANK_PACKAGE.equals(sbn.getPackageName())) return;

        Bundle extras = sbn.getNotification().extras;
        String title = str(extras.getCharSequence(Notification.EXTRA_TITLE));
        String text = str(extras.getCharSequence(Notification.EXTRA_TEXT));
        String big = str(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (!big.isEmpty()) text = big;
        if (title.isEmpty() && text.isEmpty()) return;

        Store store = new Store(this);
        store.log("카카오뱅크 알림 수신: [" + title + "] " + text);
        Sender.submit(this, title, text);
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
