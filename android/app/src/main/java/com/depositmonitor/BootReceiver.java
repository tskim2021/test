package com.depositmonitor;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 폰을 다시 켠 뒤에도 푸시 연결을 자동으로 이어 간다. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) return;
        Store s = new Store(c);
        if (s.pushEnabled() && !s.serverUrl().isEmpty() && !s.token().isEmpty()) {
            try { PushService.start(c); } catch (Exception ignored) { }
        }
    }
}
