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
            // 문자 앱 알림만, 그리고 보낸 사람이 은행(카카오뱅크 1599-3333, NH농협 1588-2100 또는 저장된 이름)인 것만 본다(이메일 등 제외)
            if (!SmsPick.isMessagingApp(pkg)) return;
            String from = str(extras.getCharSequence(Notification.EXTRA_TITLE)) + " " + str(extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE));
            if (!SmsPick.isBankSender(from) && !from.contains("카카오뱅크") && !from.contains("농협")) {
                // 보낸 사람 표시가 은행이 아닌데 본문이 은행 입금 형식이면 보내지는 않고 원인 확인용으로만 기록(기업 메시지는 제목이 '알림' 등으로 올 수 있음)
                String all = SmsPick.norm(from + " | " + str(extras.getCharSequence(Notification.EXTRA_TEXT)) + " | " + str(extras.getCharSequence(Notification.EXTRA_BIG_TEXT)));
                if (all.contains("입금")) store.log("은행 확인 안 됨(" + pkg + ") 보낸사람=[" + from.trim() + "] " + (all.length() > 120 ? all.substring(0, 120) : all));
                return;
            }
            if (!onSms(store, sbn, extras)) {
                // 은행 문자 알림인데 입금으로 못 읽은 것(출금·기업메시지 형식 차이 등)은 원인 확인용으로 로그에 남긴다
                String peek = SmsPick.norm(str(extras.getCharSequence(Notification.EXTRA_TITLE)) + " | " + str(extras.getCharSequence(Notification.EXTRA_TEXT)) + " | " + str(extras.getCharSequence(Notification.EXTRA_BIG_TEXT)));
                if (!peek.contains("출금")) store.log("은행 알림 거름(" + pkg + "): " + (peek.length() > 120 ? peek.substring(0, 120) : peek));
            }
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

    // 문자 앱 알림: 메시지가 여러 개 묶여 있으면 하나씩 꺼내서 본다. 입금 문자를 하나라도 찾으면(이미 보낸 것 포함) true.
    private boolean onSms(Store store, StatusBarNotification sbn, Bundle extras) {
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
        // 기업 메시지(RCS)는 본문이 제목·내용·요약으로 나뉘어 오기도 해서 이어 붙인 것도 본다
        texts.add(str(extras.getCharSequence(Notification.EXTRA_TITLE)) + " " + str(extras.getCharSequence(Notification.EXTRA_TEXT)) + " "
                + str(extras.getCharSequence(Notification.EXTRA_SUB_TEXT)) + " " + str(extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)));
        times.add(sbn.getPostTime());
        texts.add(str(extras.getCharSequence(Notification.EXTRA_TITLE)) + " " + str(extras.getCharSequence(Notification.EXTRA_BIG_TEXT))); times.add(sbn.getPostTime());

        List<String> found = SmsPick.pick(texts, times, System.currentTimeMillis());
        for (String t : found) {
            if (!store.markSent(SmsPick.key(t))) continue; // 이미 보낸 문자(직접 수신 경로와 겹쳐도 한 번만)
            store.log("은행 입금 문자 수신: " + t);
            Sender.submit(this, "", t);
        }
        return !found.isEmpty();
    }

    @Override
    public void onListenerConnected() {
        new Store(this).log("알림 읽기 연결됨 (수집 방식: " + (new Store(this).smsMode() ? "은행 입금 문자" : "카카오뱅크 앱 알림") + ")");
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
