package com.depositmonitor;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 문자 앱 알림에서 카카오뱅크 입금 문자만 골라낸다(카카오뱅크 앱 알림 대신 문자로 받는 모드).
 * 문자 앱은 예전 문자까지 한 알림에 묶어 다시 올리기도 하므로, 본문의 시각(예: "10/30 16:23")이
 * 지금으로부터 MAX_AGE_MIN 분 이내인 것만 고른다. 시각이 없으면 알림의 시각으로 판단한다.
 */
final class SmsPick {
    static final int MAX_AGE_MIN = 15;
    private static final Pattern WHEN = Pattern.compile("(\\d{1,2})/(\\d{1,2})\\s+(\\d{1,2}):(\\d{2})");
    private static final TimeZone KST = TimeZone.getTimeZone("Asia/Seoul");

    static String norm(String s) { return s == null ? "" : s.replaceAll("\\s+", " ").trim(); }

    static boolean isDepositSms(String t) { return t.contains("카카오뱅크") && t.contains("입금"); }

    /** 본문의 "월/일 시:분"(한국시간)을 epoch ms 로. 없으면 -1. 연도는 now 기준(연말·연초 경계 보정). */
    static long bodyTime(String t, long now) {
        Matcher m = WHEN.matcher(t);
        if (!m.find()) return -1;
        Calendar c = Calendar.getInstance(KST);
        c.setTimeInMillis(now);
        int year = c.get(Calendar.YEAR);
        int month = Integer.parseInt(m.group(1)) - 1;
        if (month == 11 && c.get(Calendar.MONTH) == 0) year--; // 1월에 받은 12월 문자
        c.clear();
        c.setTimeZone(KST);
        c.set(year, month, Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)), Integer.parseInt(m.group(4)));
        return c.getTimeInMillis();
    }

    /** 후보 문장들(알림의 메시지별 본문 등)에서 최근 카카오뱅크 입금 문자만 정리해 돌려준다. msgTime: 메시지/알림 시각(ms). */
    static List<String> pick(List<String> texts, List<Long> msgTimes, long now) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (int i = 0; i < texts.size(); i++) {
            String t = norm(texts.get(i));
            if (t.isEmpty() || !isDepositSms(t)) continue;
            long when = bodyTime(t, now);
            if (when < 0) when = i < msgTimes.size() && msgTimes.get(i) != null ? msgTimes.get(i) : now;
            if (Math.abs(now - when) > MAX_AGE_MIN * 60_000L) continue;
            out.add(t);
        }
        return new ArrayList<>(out);
    }
}
