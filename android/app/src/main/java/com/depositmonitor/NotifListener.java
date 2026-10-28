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
    public void onListenerDisconnected() {
        // 시스템이 연결을 끊었을 때 다시 붙는다.
        requestRebind(new ComponentName(this, NotifListener.class));
    }

    private static String str(CharSequence s) { return s == null ? "" : s.toString(); }
}
