package com.dalatcafe.server;

import com.dalatcafe.util.Json;
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

import static org.junit.jupiter.api.Assertions.*;

class JsonRequestTest {
    private HttpServer server;
    private URI endpoint;
    private final HttpClient client = HttpClient.newHttpClient();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/echo", new ApiHandler() {
            @Override
            protected void route(com.sun.net.httpserver.HttpExchange exchange) throws IOException {
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
    @ValueSource(strings = {"{\"qty\":+1}", "{\"qty\":01}", "{\"qty\":1.}",
            "{\"name\":\"\\u+041\"}", "{\u000b\"qty\":1}"})
    void malformedJsonReturnsBadRequest(String body) throws Exception {
        HttpResponse<String> response = post(body);
        assertEquals(400, response.statusCode(), response.body());
        assertEquals("INVALID_INPUT", Json.parseObject(response.body()).get("code"));
    }

    @Test
    void validJsonRetainsTheResponseEnvelope() throws Exception {
        HttpResponse<String> response = post("{\"qty\":1e+2,\"name\":\"Đà Lạt \\u0041\"}");
        assertEquals(200, response.statusCode(), response.body());
        assertEquals(Json.parse("{\"ok\":true,\"data\":{\"qty\":100,\"name\":\"Đà Lạt A\"}}"),
                Json.parse(response.body()));
    }

    private HttpResponse<String> post(String body) throws Exception {
        return client.send(HttpRequest.newBuilder(endpoint)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
}
