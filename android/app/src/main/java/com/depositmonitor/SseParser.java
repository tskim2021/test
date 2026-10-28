package com.depositmonitor;

/** text/event-stream 을 한 줄씩 받아 이벤트(이름, data)를 완성한다. 주석(':') 줄과 빈 이벤트는 무시한다. */
final class SseParser {
    static final class Event {
        final String name;
        final String data;
        Event(String name, String data) { this.name = name; this.data = data; }
    }

    private String name = "message";
    private final StringBuilder data = new StringBuilder();

    /** 이벤트가 완성되면(빈 줄을 만나면) 그 이벤트를, 아니면 null 을 돌려준다. */
    Event feed(String line) {
        if (line.isEmpty()) {
            if (data.length() == 0) { name = "message"; return null; }
            Event e = new Event(name, data.toString());
            name = "message";
            data.setLength(0);
            return e;
        }
        if (line.charAt(0) == ':') return null;
        int i = line.indexOf(':');
        String field = i < 0 ? line : line.substring(0, i);
        String value = i < 0 ? "" : line.substring(i + 1);
        if (value.startsWith(" ")) value = value.substring(1);
        if (field.equals("event")) name = value;
        else if (field.equals("data")) { if (data.length() > 0) data.append('\n'); data.append(value); }
        return null;
    }
}
