package com.depositmonitor;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;

public class PushLogicTest {
    @Test public void sseParser_assemblesEvents() {
        SseParser p = new SseParser();
        assertNull(p.feed(": connected"));
        assertNull(p.feed(""));                      // 데이터 없는 빈 줄은 이벤트가 아님
        assertNull(p.feed("event: deposit"));
        assertNull(p.feed("data: {\"id\":1,\"amount\":50000}"));
        SseParser.Event e = p.feed("");
        assertNotNull(e);
        assertEquals("deposit", e.name);
        assertEquals("{\"id\":1,\"amount\":50000}", e.data);
        assertNull(p.feed("data:{\"x\":1}"));        // 공백 없는 data:
        e = p.feed("");
        assertEquals("message", e.name);             // event 줄이 없으면 message
        assertEquals("{\"x\":1}", e.data);
        p.feed("event: processed"); p.feed("data: a"); p.feed("data: b");
        e = p.feed("");
        assertEquals("a\nb", e.data);                // 여러 data 줄은 개행으로 이음
        assertNull(p.feed(": ping"));
    }

    @Test public void needsProcessing_textByMatchLevel() throws Exception {
        String[] t = PushText.needsProcessing(new JSONObject("{\"id\":1,\"sender\":\"이상덕\",\"amount\":35900,\"shop\":true,\"match_level\":\"full\"}"));
        assertEquals("💰 입금 35,900원 · 처리 필요", t[0]);
        assertEquals("이상덕 · 일치하는 주문이 있어 바로 처리할 수 있어요", t[1]);
        assertTrue(PushText.needsProcessing(new JSONObject("{\"sender\":\"가\",\"amount\":1,\"shop\":true,\"match_level\":\"name\"}"))[1].contains("이름만 일치"));
        assertTrue(PushText.needsProcessing(new JSONObject("{\"sender\":\"가\",\"amount\":1,\"shop\":true,\"match_level\":\"amount\"}"))[1].contains("금액만 일치"));
        assertTrue(PushText.needsProcessing(new JSONObject("{\"sender\":\"가\",\"amount\":1,\"shop\":true,\"match_level\":\"other\"}"))[1].contains("이미 처리된"));
        assertTrue(PushText.needsProcessing(new JSONObject("{\"sender\":\"가\",\"amount\":1,\"shop\":true,\"match_level\":null}"))[1].contains("일치하는 주문이 없어요"));
        assertTrue(PushText.needsProcessing(new JSONObject("{\"sender\":\"가\",\"amount\":1}"))[1].contains("처리가 필요합니다")); // 쇼핑몰 미연동
        assertTrue(PushText.needsProcessing(new JSONObject("{\"sender\":null,\"amount\":1234567}"))[0].contains("1,234,567원"));
        assertTrue(PushText.needsProcessing(new JSONObject("{\"sender\":null,\"amount\":1}"))[1].startsWith("(입금자 미확인)"));
    }

    @Test public void processed_text() throws Exception {
        String[] t = PushText.processed(new JSONObject("{\"id\":2,\"sender\":\"이전희\",\"amount\":825400,\"od_id\":\"A2026\",\"manual\":true,\"memo\":\"환율 차이\"}"));
        assertEquals("✅ 처리 완료 · 825,400원", t[0]);
        assertEquals("이전희 → 주문 A2026 (수동 처리) · 환율 차이", t[1]);
        String[] auto = PushText.processed(new JSONObject("{\"id\":3,\"sender\":\"곽도빈\",\"amount\":26400,\"od_id\":\"A1\",\"manual\":0,\"memo\":\"\"}"));
        assertEquals("곽도빈 → 주문 A1", auto[1]);                       // 따라잡기 응답은 manual 이 0/1
        assertTrue(PushText.processed(new JSONObject("{\"id\":3,\"sender\":\"가\",\"amount\":1,\"od_id\":\"A1\",\"manual\":1,\"memo\":null}"))[1].contains("(수동 처리)"));
    }
}
