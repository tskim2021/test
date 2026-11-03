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

    /** 카카오뱅크가 보낸 입금 문자 형식("[카카오뱅크] … 입금 N원"). 이메일 등에 '카카오뱅크'라는 말이 들어간 것은 제외. */
    static boolean isDepositSms(String t) {
        if (t.contains("[카카오뱅크]")) return t.matches("(?s).*입금\\s*[\\d,]+\\s*원.*");
        // 농협: "농협 입금165,500원 11/03 21:15 352-****-6720-13 정상목 잔액…"
        return NH.matcher(norm(t)).find();
    }
    private static final Pattern NH = Pattern.compile("농협\\s*입금\\s*[\\d,]+\\s*원\\s+\\d{1,2}/\\d{1,2}\\s+\\d{1,2}:\\d{2}\\s+\\d+-\\*+-[\\d-]+\\s+\\S");

    /** 은행 문자 발신번호: 카카오뱅크 1599-3333, NH농협 1588-2100 */
    static boolean isBankSender(String s) {
        if (s == null) return false;
        String d = s.replaceAll("[^0-9]", "");
        return d.endsWith("15993333") || d.endsWith("15882100"); // 카카오뱅크, NH농협
    }

    /** 문자 앱 알림인지(삼성 메시지, 구글 메시지, 기본 문자 앱 등). Gmail·메신저 알림은 제외. */
    static boolean isMessagingApp(String pkg) {
        if (pkg == null) return false;
        String p = pkg.toLowerCase();
        return p.equals("com.samsung.android.messaging") || p.equals("com.google.android.apps.messaging")
            || p.equals("com.android.mms") || p.equals("com.android.messaging") || p.contains(".mms") || p.contains("sms")
            || (p.contains("messag") && !p.contains("gm") && !p.contains("facebook") && !p.contains("kakao") && !p.contains("telegram") && !p.contains("whatsapp"));
    }

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

    private static final Pattern KEY = Pattern.compile("(\\d{1,2}/\\d{1,2}\\s+\\d{1,2}:\\d{2}).*?입금\\s*([\\d,]+)\\s*원\\s*([^\\s]*)");
    private static final Pattern NH_KEY = Pattern.compile("입금\\s*([\\d,]+)\\s*원\\s+(\\d{1,2}/\\d{1,2}\\s+\\d{1,2}:\\d{2})\\s+\\d+-\\*+-[\\d-]+\\s+(.+?)(?:\\s+잔액.*)?$");

    /** 같은 입금 문자인지 판단하는 키(시각·금액·입금자). 문자 앱 알림과 직접 수신의 앞머리([Web발신] 등)가 달라도 같게 나온다. */
    static String key(String t) {
        String n = norm(t);
        Matcher h = NH_KEY.matcher(n); // 농협: 입금액이 시각보다 먼저
        if (h.find()) return h.group(2).replaceAll("\\s+", " ") + "|" + h.group(1) + "|" + h.group(3);
        Matcher m = KEY.matcher(n);
        return m.find() ? m.group(1).replaceAll("\\s+", " ") + "|" + m.group(2) + "|" + (m.group(3).startsWith("잔액") ? "" : m.group(3)) : n;
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
