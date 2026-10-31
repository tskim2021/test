package com.depositmonitor;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import java.util.Collections;

/**
 * 문자가 도착하는 순간을 직접 받는다(문자 앱 알림이 안 생기는 경우 대비: 대화방을 열어 둔 상태, 알림 묶임 등).
 * 문자 앱 알림 경로(NotifListener)와 같은 문자가 겹치면 SmsPick.key 로 한 번만 보낸다.
 */
public class SmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        Store store = new Store(c);
        if (!store.smsMode()) return;
        SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (parts == null || parts.length == 0) return;
        StringBuilder body = new StringBuilder(); // 긴 문자는 여러 조각으로 온다
        for (SmsMessage m : parts) if (m != null && m.getMessageBody() != null) body.append(m.getMessageBody());
        long now = System.currentTimeMillis();
        for (String t : SmsPick.pick(Collections.singletonList(body.toString()), Collections.singletonList(now), now)) {
            if (!store.markSent(SmsPick.key(t))) continue;
            store.log("카카오뱅크 문자 수신(직접): " + t);
            Sender.submit(c, "", t);
        }
    }
}
