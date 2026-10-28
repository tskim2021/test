package com.depositmonitor;

import org.json.JSONObject;
import java.text.NumberFormat;
import java.util.Locale;

/** 푸시 알림에 들어갈 문구. 서버가 보낸 JSON 에서 제목/본문을 만든다. */
final class PushText {
    static String won(long n) { return NumberFormat.getInstance(Locale.KOREA).format(n) + "원"; }

    /** 새 입금: 처리가 필요하다는 알림 [제목, 본문] */
    static String[] needsProcessing(JSONObject d) {
        String sender = d.optString("sender", "");
        if (sender.isEmpty() || d.isNull("sender")) sender = "(입금자 미확인)";
        String title = "💰 입금 " + won(d.optLong("amount")) + " · 처리 필요";
        String hint;
        if (!d.optBoolean("shop", false)) hint = "처리가 필요합니다";
        else {
            switch (d.isNull("match_level") ? "" : d.optString("match_level", "")) {
                case "full":   hint = "일치하는 주문이 있어 바로 처리할 수 있어요"; break;
                case "name":   hint = "이름만 일치해요 · 금액 확인 필요"; break;
                case "amount": hint = "금액만 일치해요 · 입금자 확인 필요"; break;
                case "other":  hint = "이미 처리된 주문과 일치해요"; break;
                default:       hint = "일치하는 주문이 없어요 · 확인 필요";
            }
        }
        return new String[] { title, sender + " · " + hint };
    }

    /** 처리 완료 알림 [제목, 본문] */
    static String[] processed(JSONObject p) {
        String sender = p.isNull("sender") || p.optString("sender", "").isEmpty() ? "(입금자 미확인)" : p.optString("sender");
        String title = "✅ 처리 완료 · " + won(p.optLong("amount"));
        StringBuilder b = new StringBuilder(sender).append(" → 주문 ").append(p.optString("od_id"));
        // 처리 종류: 0 자동(시스템) 1 수동 2 기처리 연결 3 일치처리(관리자 확인). 실시간 이벤트는 kind, 따라잡기 응답은 manual 에 같은 숫자가 온다.
        Object k = p.has("kind") ? p.opt("kind") : p.opt("manual");
        int kind = k instanceof Boolean ? ((Boolean) k ? 1 : 0) : k instanceof Number ? ((Number) k).intValue() : 0;
        if (p.optBoolean("linked", false)) kind = 2;
        if (kind == 0) b.append(" (자동 처리)");
        else if (kind == 1) b.append(" (수동 처리)");
        else if (kind == 2) b.append(" (기처리 주문 연결)");
        String memo = p.isNull("memo") ? "" : p.optString("memo", "");
        if (!memo.isEmpty()) b.append(" · ").append(memo);
        return new String[] { title, b.toString() };
    }
}
