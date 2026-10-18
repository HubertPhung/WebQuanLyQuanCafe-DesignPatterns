package com.dalatcafe.server;

import com.dalatcafe.util.Json;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Base class of the REST handlers: JSON envelope, body reading and uniform error mapping
 * ({"ok":true,"data":...} / {"ok":false,"error":...,"code":...}).
 */
public abstract class ApiHandler implements HttpHandler {
    private static final Logger LOGGER = Logger.getLogger(ApiHandler.class.getName());
    static final int MAX_BODY_BYTES = 1024 * 1024;
    private static final String JSON_UTF8 = "application/json; charset=UTF-8";

    /** Routes the request; may throw {@link ApiException} for expected failures. */
    protected abstract void route(HttpExchange exchange) throws IOException;

    @Override
    public final void handle(HttpExchange exchange) throws IOException {
        try {
            route(exchange);
        } catch (ApiException e) {
            sendError(exchange, e.getStatus(), e.getCode(), e.getMessage());
        } catch (Json.JsonException e) {
            sendError(exchange, 400, "INVALID_INPUT", "Malformed JSON: " + e.getMessage());
        } catch (RuntimeException e) {
            LOGGER.log(Level.SEVERE, "Unhandled error for " + exchange.getRequestURI(), e);
            sendError(exchange, 500, "INTERNAL_SERVER_ERROR", "Internal server error");
        } finally {
            exchange.close();
        }
    }

    // ---- responses ----

    public static void sendOk(HttpExchange exchange, int status, Object data, String message) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        if (data != null) {
            body.put("data", data);
        }
        if (message != null) {
            body.put("message", message);
        }
        send(exchange, status, body);
    }

    public static void sendError(HttpExchange exchange, int status, String code, String message) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", false);
        body.put("error", message);
        body.put("code", code);
        send(exchange, status, body);
    }

    private static void send(HttpExchange exchange, int status, Object body) throws IOException {
        byte[] bytes = Json.stringify(body).getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", JSON_UTF8);
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }

    // ---- request helpers ----

    protected static Map<String, Object> readJsonBody(HttpExchange exchange) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (InputStream in = exchange.getRequestBody()) {
            byte[] chunk = new byte[4096];
            int read;
            while ((read = in.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
                if (buffer.size() > MAX_BODY_BYTES) {
                    throw new ApiException(413, "INVALID_INPUT", "Request body too large");
                }
            }
        }
        String text;
        try {
            text = StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(buffer.toByteArray())).toString();
        } catch (CharacterCodingException e) {
            throw ApiException.badRequest("Request body must be valid UTF-8");
        }
        if (text.isBlank()) {
            throw ApiException.badRequest("Request body is required");
        }
        return Json.parseObject(text);
    }

    /** Path segments after the leading "/api", e.g. /api/tables/3/status -> [tables, 3, status]. */
    protected static List<String> segments(HttpExchange exchange) {
        String path = exchange.getRequestURI().getPath();
        return List.of(path.replaceAll("^/+|/+$", "").split("/"));
    }

    /** First value of a query-string parameter (URL-decoded), or null when absent or blank. */
    protected static String queryParam(HttpExchange exchange, String name) {
        String query = exchange.getRequestURI().getRawQuery();
        if (query == null) {
            return null;
        }
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            String key = URLDecoder.decode(eq < 0 ? pair : pair.substring(0, eq), StandardCharsets.UTF_8);
            if (key.equals(name)) {
                String value = eq < 0 ? "" : URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
                return value.isBlank() ? null : value;
            }
        }
        return null;
    }

    protected static ApiException methodNotAllowed(HttpExchange exchange) {
        return new ApiException(405, "INVALID_INPUT", "Method not allowed: " + exchange.getRequestMethod());
    }

    protected static int parseId(String raw) {
        try {
            int id = Integer.parseInt(raw);
            if (id <= 0) {
                throw ApiException.badRequest("Invalid id: " + raw);
            }
            return id;
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("Invalid id: " + raw);
        }
    }

    // ---- JSON field helpers ----

    protected static String str(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) {
            return null;
        }
        if (!(value instanceof String)) {
            throw ApiException.badRequest("Field '" + key + "' must be a string");
        }
        String s = ((String) value).trim();
        return s.isEmpty() ? null : s;
    }

    protected static String requireStr(Map<String, Object> map, String key) {
        String value = str(map, key);
        if (value == null) {
            throw ApiException.badRequest("Field '" + key + "' is required");
        }
        return value;
    }

    protected static Double num(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) {
            return null;
        }
        if (!(value instanceof Double)) {
            throw ApiException.badRequest("Field '" + key + "' must be a number");
        }
        return (Double) value;
    }

    protected static int requireInt(Map<String, Object> map, String key) {
        Double value = num(map, key);
        if (value == null || value != Math.rint(value) || Math.abs(value) > Integer.MAX_VALUE) {
            throw ApiException.badRequest("Field '" + key + "' must be an integer");
        }
        return value.intValue();
    }

    protected static boolean bool(Map<String, Object> map, String key, boolean defaultValue) {
        Object value = map.get(key);
        if (value == null) {
            return defaultValue;
        }
        if (!(value instanceof Boolean)) {
            throw ApiException.badRequest("Field '" + key + "' must be a boolean");
        }
        return (Boolean) value;
    }

    @SuppressWarnings("unchecked")
    protected static List<Object> list(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) {
            return List.of();
        }
        if (!(value instanceof List)) {
            throw ApiException.badRequest("Field '" + key + "' must be an array");
        }
        return (List<Object>) value;
    }

    @SuppressWarnings("unchecked")
    protected static Map<String, Object> asObject(Object value, String what) {
        if (!(value instanceof Map)) {
            throw ApiException.badRequest(what + " must be an object");
        }
        return (Map<String, Object>) value;
    }
}
