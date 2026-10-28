package com.depositmonitor;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

/** 알림 채널과 알림 표시. 같은 입금의 '처리 필요' 알림은 '처리 완료'로 바뀌어 한 줄만 남는다. */
final class Notifier {
    static final String CH_NEEDS = "needs";
    static final String CH_DONE = "done";
    static final String CH_STATUS = "status";

    static void ensureChannels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CH_NEEDS, "처리 필요 (새 입금)", NotificationManager.IMPORTANCE_HIGH));
        nm.createNotificationChannel(new NotificationChannel(CH_DONE, "처리 완료", NotificationManager.IMPORTANCE_DEFAULT));
        nm.createNotificationChannel(new NotificationChannel(CH_STATUS, "연결 상태", NotificationManager.IMPORTANCE_MIN));
    }

    private static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static Notification status(Context c, String text) {
        return new Notification.Builder(c, CH_STATUS)
                .setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
                .setContentTitle("입금 모니터")
                .setContentText(text)
                .setOngoing(true)
                .setContentIntent(openApp(c))
                .build();
    }

    private static void post(Context c, String channel, int id, String[] text) {
        Notification n = new Notification.Builder(c, channel)
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setContentTitle(text[0])
                .setContentText(text[1])
                .setStyle(new Notification.BigTextStyle().bigText(text[1]))
                .setAutoCancel(true)
                .setContentIntent(openApp(c))
                .build();
        c.getSystemService(NotificationManager.class).notify(id, n);
    }

    static void needs(Context c, org.json.JSONObject d) { post(c, CH_NEEDS, (int) d.optLong("id"), PushText.needsProcessing(d)); }

    static void done(Context c, org.json.JSONObject p) { post(c, CH_DONE, (int) p.optLong("id"), PushText.processed(p)); }

    /** 서버에서 보낸 테스트 푸시. kind: basic / needs(처리 필요 예시) / done(처리 완료 예시). 실제 알림과 구분되도록 [테스트]를 붙이고 알림 번호도 따로 쓴다. */
    static void test(Context c, org.json.JSONObject d) {
        String kind = d == null ? "basic" : d.optString("kind", "basic");
        if (kind.equals("needs")) {
            String[] t = PushText.needsProcessing(d);
            post(c, CH_NEEDS, 999998, new String[] { "[테스트] " + t[0], t[1] });
        } else if (kind.equals("done")) {
            String[] t = PushText.processed(d);
            post(c, CH_DONE, 999997, new String[] { "[테스트] " + t[0], t[1] });
        } else {
            post(c, CH_NEEDS, 999999, new String[] { "🔔 푸시 테스트", "서버 → 앱 푸시가 정상입니다. 입금이 들어오면 이렇게 알려 드려요" });
        }
    }

    /** 따라잡기에서 너무 많을 때 한 건으로 묶는다. */
    static void summary(Context c, int count) {
        post(c, CH_NEEDS, 0, new String[] { "💰 처리 필요 " + count + "건", "연결이 끊긴 사이 들어온 입금입니다. 목록에서 확인하세요" });
    }
}
