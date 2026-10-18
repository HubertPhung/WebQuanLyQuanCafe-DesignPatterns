package com.dalatcafe.util;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

class JsonTest {
    @ParameterizedTest
    @ValueSource(strings = {"+1", "01", "-01", ".5", "-.5", "1.", "1.e2", "1e", "1e+", "--1"})
    void rejectsMalformedNumbers(String number) {
        assertThrows(Json.JsonException.class, () -> Json.parse(number));
        assertThrows(Json.JsonException.class, () -> Json.parse("{\"quantity\":" + number + "}"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-0", "10", "-10", "0.5", "-0.5", "1e2", "1E+2", "1e-2", "1.25e+2"})
    void acceptsValidNumbers(String number) {
        assertEquals(Double.parseDouble(number), Json.parse(number));
    }

    @ParameterizedTest
    @ValueSource(strings = {"\u000b", "\u000c", "\u001c", "\u2003"})
    void rejectsWhitespaceOutsideJsonGrammar(String whitespace) {
        assertThrows(Json.JsonException.class, () -> Json.parse(whitespace + "1"));
        assertThrows(Json.JsonException.class, () -> Json.parse("[1," + whitespace + "2]"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"+041", "-001", "１２３４"})
    void rejectsNonHexUnicodeEscapes(String escape) {
        assertThrows(Json.JsonException.class, () -> Json.parse("\"\\u" + escape + "\""));
    }

    @ParameterizedTest
    @ValueSource(strings = {" ", "\t", "\r", "\n", " \t\r\n"})
    void acceptsJsonWhitespace(String whitespace) {
        assertEquals(1.0, Json.parse(whitespace + "1" + whitespace));
    }
}
