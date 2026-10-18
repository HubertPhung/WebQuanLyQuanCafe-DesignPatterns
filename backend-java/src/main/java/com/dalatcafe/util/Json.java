package com.dalatcafe.util;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal JSON reader/writer (pure Java SE, no third-party library).
 * Parsed values are Map (LinkedHashMap), List, String, Double, Boolean or null.
 */
public final class Json {
    private static final int MAX_DEPTH = 64;
    private static final java.util.regex.Pattern JSON_NUMBER = java.util.regex.Pattern.compile(
            "-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?");

    private final String text;
    private int pos;

    private Json(String text) {
        this.text = text;
    }

    /** Thrown for malformed JSON input. */
    public static final class JsonException extends RuntimeException {
        public JsonException(String message) {
            super(message);
        }
    }

    public static Object parse(String text) {
        if (text == null) {
            throw new JsonException("Empty JSON body");
        }
        Json parser = new Json(text);
        parser.skipWhitespace();
        Object value = parser.readValue(0);
        parser.skipWhitespace();
        if (parser.pos != text.length()) {
            throw new JsonException("Unexpected trailing characters at " + parser.pos);
        }
        return value;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> parseObject(String text) {
        Object value = parse(text);
        if (!(value instanceof Map)) {
            throw new JsonException("JSON object expected");
        }
        return (Map<String, Object>) value;
    }

    public static String stringify(Object value) {
        StringBuilder out = new StringBuilder();
        write(out, value);
        return out.toString();
    }

    // ---- reading ----

    private Object readValue(int depth) {
        if (depth > MAX_DEPTH) {
            throw new JsonException("JSON nested too deeply");
        }
        if (pos >= text.length()) {
            throw new JsonException("Unexpected end of JSON");
        }
        char c = text.charAt(pos);
        switch (c) {
            case '{':
                return readObject(depth);
            case '[':
                return readArray(depth);
            case '"':
                return readString();
            case 't':
                expect("true");
                return Boolean.TRUE;
            case 'f':
                expect("false");
                return Boolean.FALSE;
            case 'n':
                expect("null");
                return null;
            default:
                return readNumber();
        }
    }

    private Map<String, Object> readObject(int depth) {
        Map<String, Object> map = new LinkedHashMap<>();
        pos++;
        skipWhitespace();
        if (peek() == '}') {
            pos++;
            return map;
        }
        while (true) {
            skipWhitespace();
            if (peek() != '"') {
                throw new JsonException("Object key expected at " + pos);
            }
            String key = readString();
            skipWhitespace();
            if (peek() != ':') {
                throw new JsonException("':' expected at " + pos);
            }
            pos++;
            skipWhitespace();
            map.put(key, readValue(depth + 1));
            skipWhitespace();
            char next = peek();
            pos++;
            if (next == '}') {
                return map;
            }
            if (next != ',') {
                throw new JsonException("',' or '}' expected at " + (pos - 1));
            }
        }
    }

    private List<Object> readArray(int depth) {
        List<Object> list = new ArrayList<>();
        pos++;
        skipWhitespace();
        if (peek() == ']') {
            pos++;
            return list;
        }
        while (true) {
            skipWhitespace();
            list.add(readValue(depth + 1));
            skipWhitespace();
            char next = peek();
            pos++;
            if (next == ']') {
                return list;
            }
            if (next != ',') {
                throw new JsonException("',' or ']' expected at " + (pos - 1));
            }
        }
    }

    private String readString() {
        StringBuilder sb = new StringBuilder();
        pos++;
        while (true) {
            if (pos >= text.length()) {
                throw new JsonException("Unterminated string");
            }
            char c = text.charAt(pos++);
            if (c == '"') {
                return sb.toString();
            }
            if (c < 0x20) {
                throw new JsonException("Control character in string at " + (pos - 1));
            }
            if (c != '\\') {
                sb.append(c);
                continue;
            }
            if (pos >= text.length()) {
                throw new JsonException("Unterminated escape");
            }
            char e = text.charAt(pos++);
            switch (e) {
                case '"': sb.append('"'); break;
                case '\\': sb.append('\\'); break;
                case '/': sb.append('/'); break;
                case 'b': sb.append('\b'); break;
                case 'f': sb.append('\f'); break;
                case 'n': sb.append('\n'); break;
                case 'r': sb.append('\r'); break;
                case 't': sb.append('\t'); break;
                case 'u':
                    if (pos + 4 > text.length()) {
                        throw new JsonException("Invalid unicode escape");
                    }
                    for (int i = pos; i < pos + 4; i++) {
                        char hex = text.charAt(i);
                        if (!(hex >= '0' && hex <= '9') && !(hex >= 'a' && hex <= 'f')
                                && !(hex >= 'A' && hex <= 'F')) {
                            throw new JsonException("Invalid unicode escape at " + pos);
                        }
                    }
                    try {
                        sb.append((char) Integer.parseInt(text.substring(pos, pos + 4), 16));
                    } catch (NumberFormatException ex) {
                        throw new JsonException("Invalid unicode escape at " + pos);
                    }
                    pos += 4;
                    break;
                default:
                    throw new JsonException("Invalid escape '\\" + e + "'");
            }
        }
    }

    private Double readNumber() {
        int start = pos;
        while (pos < text.length() && "+-0123456789.eE".indexOf(text.charAt(pos)) >= 0) {
            pos++;
        }
        if (start == pos) {
            throw new JsonException("Unexpected character '" + text.charAt(pos) + "' at " + pos);
        }
        String number = text.substring(start, pos);
        if (!JSON_NUMBER.matcher(number).matches()) {
            throw new JsonException("Invalid number at " + start);
        }
        try {
            double value = Double.parseDouble(number);
            if (!Double.isFinite(value)) {
                throw new JsonException("Number out of range at " + start);
            }
            return value;
        } catch (NumberFormatException e) {
            throw new JsonException("Invalid number at " + start);
        }
    }

    private void expect(String literal) {
        if (!text.startsWith(literal, pos)) {
            throw new JsonException("Unexpected token at " + pos);
        }
        pos += literal.length();
    }

    private char peek() {
        if (pos >= text.length()) {
            throw new JsonException("Unexpected end of JSON");
        }
        return text.charAt(pos);
    }

    private void skipWhitespace() {
        while (pos < text.length() && " \t\r\n".indexOf(text.charAt(pos)) >= 0) {
            pos++;
        }
    }

    // ---- writing ----

    private static void write(StringBuilder out, Object value) {
        if (value == null) {
            out.append("null");
        } else if (value instanceof String || value instanceof Enum || value instanceof java.time.Instant) {
            writeString(out, value.toString());
        } else if (value instanceof Boolean) {
            out.append(value);
        } else if (value instanceof Number) {
            writeNumber(out, (Number) value);
        } else if (value instanceof Map) {
            out.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
                if (!first) {
                    out.append(',');
                }
                first = false;
                writeString(out, String.valueOf(entry.getKey()));
                out.append(':');
                write(out, entry.getValue());
            }
            out.append('}');
        } else if (value instanceof Iterable) {
            out.append('[');
            boolean first = true;
            for (Object item : (Iterable<?>) value) {
                if (!first) {
                    out.append(',');
                }
                first = false;
                write(out, item);
            }
            out.append(']');
        } else {
            writeString(out, value.toString());
        }
    }

    private static void writeNumber(StringBuilder out, Number number) {
        double d = number.doubleValue();
        if (!Double.isFinite(d)) {
            out.append("null");
        } else if (number instanceof Double || number instanceof Float) {
            if (d == Math.rint(d) && Math.abs(d) < 1e15) {
                out.append((long) d);
            } else {
                out.append(d);
            }
        } else {
            out.append(number);
        }
    }

    private static void writeString(StringBuilder out, String s) {
        out.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': out.append("\\\""); break;
                case '\\': out.append("\\\\"); break;
                case '\n': out.append("\\n"); break;
                case '\r': out.append("\\r"); break;
                case '\t': out.append("\\t"); break;
                case '\b': out.append("\\b"); break;
                case '\f': out.append("\\f"); break;
                default:
                    if (c < 0x20) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
            }
        }
        out.append('"');
    }
}
