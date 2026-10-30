package com.depositmonitor;

import static org.junit.Assert.*;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collections;
import java.util.List;
import java.util.TimeZone;
import org.junit.Test;

public class SmsPickTest {
    private static long kst(int y, int mo, int d, int h, int mi) {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("Asia/Seoul"));
        c.clear(); c.set(y, mo - 1, d, h, mi); return c.getTimeInMillis();
    }
    private static String sms(String when, String amount, String who) {
        return "[Web발신]\n[카카오뱅크]\n김*희(1526)\n" + when + "\n입금 " + amount + "원\n" + who;
    }

    @Test public void 최근_입금문자만_고른다() {
        long now = kst(2026, 10, 30, 16, 25);
        List<String> texts = Arrays.asList(
            sms("10/30 15:56", "1,000", "김미희"),     // 29분 전: 묶여서 다시 보인 옛 문자 → 제외
            sms("10/30 16:23", "89,640", "천봉상"),    // 2분 전 → 포함
            "[Web발신]\n[카카오뱅크]\n김*희(1526)\n10/30 16:24\n출금 5,000원\n스타벅스", // 출금 → 제외
            "택배가 도착했습니다",                        // 다른 문자 → 제외
            sms("10/30 16:23", "89,640", "천봉상"));   // 같은 문자 중복 → 한 번만
        List<Long> times = Collections.nCopies(texts.size(), now);
        List<String> got = SmsPick.pick(texts, times, now);
        assertEquals(1, got.size());
        assertTrue(got.get(0).contains("천봉상"));
        assertTrue(got.get(0).startsWith("[Web발신] [카카오뱅크]"));
    }

    @Test public void 시각이_없으면_알림_시각으로_판단() {
        long now = kst(2026, 10, 30, 16, 25);
        String t = "[카카오뱅크] 입금 10,000원 홍길동";
        assertEquals(1, SmsPick.pick(Arrays.asList(t), Arrays.asList(now - 60_000L), now).size());
        assertEquals(0, SmsPick.pick(Arrays.asList(t), Arrays.asList(now - 3_600_000L), now).size());
    }

    @Test public void 연초에_받은_12월_문자() {
        long now = kst(2027, 1, 1, 0, 5);
        assertEquals(kst(2026, 12, 31, 23, 58), SmsPick.bodyTime(sms("12/31 23:58", "1", "a"), now));
        assertEquals(1, SmsPick.pick(Arrays.asList(sms("12/31 23:58", "1,000", "a")), Arrays.asList(now), now).size());
    }
}
