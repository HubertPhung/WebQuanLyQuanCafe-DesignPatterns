package com.dalatcafe.server;

import com.dalatcafe.util.Json;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.assertEquals;

class Utf8RequestTest {
    private HttpServer server;
    private URI endpoint;
    private final HttpClient client = HttpClient.newHttpClient();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/echo", new ApiHandler() {
            @Override
            protected void route(HttpExchange exchange) throws IOException {
                sendOk(exchange, 200, readJsonBody(exchange), null);
            }
        });
        server.start();
        endpoint = URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/echo");
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @ParameterizedTest
    @ValueSource(strings = {"80", "c0af", "e282", "eda080", "f4908080"})
    void malformedUtf8ReturnsBadRequest(String encodedBytes) throws Exception {
        byte[] prefix = "{\"name\":\"".getBytes(StandardCharsets.UTF_8);
        byte[] invalid = HexFormat.of().parseHex(encodedBytes);
        byte[] body = new byte[prefix.length + invalid.length + 2];
        System.arraycopy(prefix, 0, body, 0, prefix.length);
        System.arraycopy(invalid, 0, body, prefix.length, invalid.length);
        body[body.length - 2] = '"';
        body[body.length - 1] = '}';

        HttpResponse<String> response = post(body);

        assertEquals(400, response.statusCode(), response.body());
        assertEquals("INVALID_INPUT", Json.parseObject(response.body()).get("code"));
    }

    @Test
    void validUnicodeIncludingReplacementCharacterIsPreserved() throws Exception {
        String body = "{\"name\":\"Đà Lạt ☕ 😀 \uFFFD\"}";

        HttpResponse<String> response = post(body.getBytes(StandardCharsets.UTF_8));

        assertEquals(200, response.statusCode(), response.body());
        assertEquals(Json.parse("{\"ok\":true,\"data\":" + body + "}"), Json.parse(response.body()));
    }

    private HttpResponse<String> post(byte[] body) throws Exception {
        return client.send(HttpRequest.newBuilder(endpoint)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
}
