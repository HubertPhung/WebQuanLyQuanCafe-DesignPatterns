package com.dalatcafe.server;

import com.dalatcafe.dao.DaoFactory;
import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.ReservationStatus;
import com.dalatcafe.model.Table;
import com.dalatcafe.model.TableStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

class ServerTest {
    private static final int DRINK_ID = 901;

    private MainServer server;
    private HttpClient client;
    private final AtomicBoolean dbUp = new AtomicBoolean(true);

    @BeforeEach
    void setUp() throws Exception {
        InMemoryDatabase.getInstance().reset();
        DaoFactory daos = DaoFactory.getInstance();
        MenuItem drink = new MenuItem(DRINK_ID, "Ca phe muoi", "Coffee", 45_000, 15_000, 10);
        drink.setInStock(true);
        daos.getMenuDao().save(drink);
        dbUp.set(true);
        server = new MainServer(0, daos, dbUp::get);
        server.start();
        client = HttpClient.newHttpClient();
    }

    @AfterEach
    void tearDown() {
        server.stop();
    }

    private HttpResponse<String> call(String method, String path, String role, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + server.getPort() + path))
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
        if (role != null) {
            builder.header("X-User-Role", role);
        }
        if (body != null) {
            builder.header("Content-Type", "application/json");
        }
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> json(HttpResponse<String> response) {
        return (Map<String, Object>) Json.parse(response.body());
    }

    private static String checkoutBody(int qty, String extra) {
        return "{\"tableId\":2,\"paymentMethod\":\"cash\",\"tenderedAmount\":200000,"
                + "\"lines\":[{\"menuItemId\":" + DRINK_ID + ",\"qty\":" + qty + ",\"size\":\"L\"}]" + extra + "}";
    }

    @Test
    void menuIsPublicJsonWithCors() throws Exception {
        HttpResponse<String> response = call("GET", "/api/menu", null, null);
        assertEquals(200, response.statusCode());
        assertEquals("application/json; charset=UTF-8", response.headers().firstValue("Content-Type").orElse(""));
        assertEquals("*", response.headers().firstValue("Access-Control-Allow-Origin").orElse(""));
        Map<String, Object> body = json(response);
        assertEquals(Boolean.TRUE, body.get("ok"));
        assertTrue(((List<?>) body.get("data")).size() > 1);
    }

    @Test
    void preflightIsAnsweredWithoutAuth() throws Exception {
        HttpResponse<String> response = call("OPTIONS", "/api/checkout", null, null);
        assertEquals(204, response.statusCode());
        assertTrue(response.headers().firstValue("Access-Control-Allow-Methods").orElse("").contains("POST"));
    }

    @Test
    void tablesRequireStaffRole() throws Exception {
        assertEquals(401, call("GET", "/api/tables", null, null).statusCode());
        HttpResponse<String> forbidden = call("GET", "/api/tables", "CUSTOMER", null);
        assertEquals(403, forbidden.statusCode());
        assertEquals("FORBIDDEN", json(forbidden).get("code"));
        assertEquals(401, call("GET", "/api/tables", "root", null).statusCode());
        assertEquals(200, call("GET", "/api/tables", "STAFF", null).statusCode());
    }

    @Test
    void updatesTableStatusAndValidatesInput() throws Exception {
        assertEquals(200, call("PATCH", "/api/tables/1/status", "STAFF", "{\"status\":\"cleaning\"}").statusCode());
        assertEquals(200, call("PUT", "/api/tables/1", "STAFF", "{\"status\":\"available\"}").statusCode());
        assertEquals(400, call("PATCH", "/api/tables/1/status", "STAFF", "{\"status\":\"broken\"}").statusCode());
        assertEquals(404, call("PATCH", "/api/tables/9999/status", "STAFF", "{\"status\":\"cleaning\"}").statusCode());
        assertEquals(400, call("PATCH", "/api/tables/1/status", "STAFF", "{not json").statusCode());
    }

    @Test
    void reservationOutsideOpeningHoursFailsTheChain() throws Exception {
        String when = LocalDate.now().plusDays(2).atTime(LocalTime.of(23, 30)).toInstant(ZoneOffset.ofHours(7)).toString();
        String body = "{\"customer\":\"An\",\"contact\":\"0912345678\",\"dateTime\":\"" + when
                + "\",\"tableId\":1,\"guests\":2}";
        HttpResponse<String> response = call("POST", "/api/reservations", null, body);
        assertEquals(400, response.statusCode());
        assertEquals("CHAIN_VALIDATION_FAILED", json(response).get("code"));
    }

    @Test
    void validReservationIsCreated() throws Exception {
        String when = LocalDate.now().plusDays(2).atTime(LocalTime.of(15, 0)).toInstant(ZoneOffset.ofHours(7)).toString();
        String body = "{\"customer\":\"An\",\"contact\":\"0912345678\",\"dateTime\":\"" + when
                + "\",\"tableId\":1,\"guests\":2,\"preOrders\":[{\"name\":\"Latte\",\"qty\":2,\"price\":55000}]}";
        HttpResponse<String> response = call("POST", "/api/reservations", null, body);
        assertEquals(201, response.statusCode(), response.body());
        assertEquals(Boolean.TRUE, json(response).get("ok"));
        assertEquals(200, call("GET", "/api/reservations", "STAFF", null).statusCode());
    }

    private String createReservation(int tableId, int guests) throws Exception {
        String when = LocalDate.now().plusDays(2).atTime(LocalTime.of(10, 0)).toInstant(ZoneOffset.ofHours(7)).toString();
        String body = "{\"customer\":\"Binh\",\"contact\":\"0911222333\",\"dateTime\":\"" + when + "\",\"tableId\":" + tableId
                + ",\"guests\":" + guests + ",\"preOrders\":[{\"name\":\"Latte\",\"qty\":2,\"price\":55000}]}";
        HttpResponse<String> created = call("POST", "/api/reservations", null, body);
        assertEquals(201, created.statusCode(), created.body());
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) json(created).get("data");
        return (String) data.get("id");
    }

    @Test
    void transferTurnsReservationIntoPosOrderThroughAdapter() throws Exception {
        String code = createReservation(9, 3);

        HttpResponse<String> response = call("POST", "/api/reservations/" + code + "/transfer-pos", "STAFF", null);
        assertEquals(200, response.statusCode(), response.body());
        @SuppressWarnings("unchecked")
        Map<String, Object> order = (Map<String, Object>) json(response).get("data");
        assertEquals(code, order.get("orderCode"));
        assertEquals("pending", order.get("status"));
        assertEquals("unpaid", order.get("paymentStatus"));
        assertEquals(110_000.0, ((Number) order.get("subtotal")).doubleValue());
        assertEquals(1, ((List<?>) order.get("items")).size());

        DaoFactory daos = DaoFactory.getInstance();
        assertTrue(daos.getOrderDao().findByOrderCode(code).isPresent());
        assertEquals(ReservationStatus.SEATED, daos.getReservationDao().findByReservationCode(code).orElseThrow().getStatus());
        Table table = daos.getTableDao().findById(9).orElseThrow();
        assertEquals(TableStatus.OCCUPIED, table.getStatus());
        assertEquals(3, table.getGuestCount());
    }

    @Test
    void transferRejectsRepeatsUnknownCodesAndMissingRole() throws Exception {
        String code = createReservation(10, 2);
        String path = "/api/reservations/" + code + "/transfer-pos";
        assertEquals(401, call("POST", path, null, null).statusCode());
        assertEquals(405, call("GET", path, "STAFF", null).statusCode());
        assertEquals(200, call("POST", path, "STAFF", null).statusCode());

        HttpResponse<String> again = call("POST", path, "STAFF", null);
        assertEquals(409, again.statusCode());
        assertEquals("RESOURCE_CONFLICT", json(again).get("code"));
        assertEquals(404, call("POST", "/api/reservations/RES-NOPE/transfer-pos", "STAFF", null).statusCode());
        assertEquals(404, call("POST", "/api/reservations/" + code + "/unknown", "STAFF", null).statusCode());
    }

    @Test
    void checkoutFinalizesOrderThroughFacade() throws Exception {
        HttpResponse<String> response = call("POST", "/api/checkout", "STAFF", checkoutBody(2, ""));
        assertEquals(200, response.statusCode(), response.body());
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) json(response).get("data");
        assertEquals("paid", data.get("paymentStatus"));
        assertTrue(((Number) data.get("finalTotal")).doubleValue() > 0);
        assertTrue(((Number) data.get("changeDue")).doubleValue() > 0);
        assertEquals(8.0, DaoFactory.getInstance().getMenuDao().findById(DRINK_ID).orElseThrow().getStockQty());
    }

    @Test
    void checkoutRejectsBadRequestsWithStandardCodes() throws Exception {
        assertEquals(401, call("POST", "/api/checkout", null, checkoutBody(1, "")).statusCode());
        assertEquals(403, call("POST", "/api/checkout", "CUSTOMER", checkoutBody(1, "")).statusCode());
        assertEquals(409, call("POST", "/api/checkout", "STAFF", checkoutBody(99, "")).statusCode());
        HttpResponse<String> voucher = call("POST", "/api/checkout", "STAFF", checkoutBody(1, ",\"voucherCode\":\"NOPE\""));
        assertEquals(400, voucher.statusCode());
        assertEquals("INVALID_VOUCHER", json(voucher).get("code"));
        assertEquals(400, call("POST", "/api/checkout", "STAFF", "{\"paymentMethod\":\"cash\",\"lines\":[]}").statusCode());
        assertEquals(405, call("GET", "/api/checkout", "STAFF", null).statusCode());
    }

    @Test
    void checkoutReturns503WhenDatabaseIsDown() throws Exception {
        dbUp.set(false);
        HttpResponse<String> response = call("POST", "/api/checkout", "STAFF", checkoutBody(1, ""));
        assertEquals(503, response.statusCode());
        assertEquals("DATABASE_UNAVAILABLE", json(response).get("code"));
        assertEquals(10.0, DaoFactory.getInstance().getMenuDao().findById(DRINK_ID).orElseThrow().getStockQty());
    }

    @Test
    void jsonRoundTripsUnicodeAndEscapes() {
        Map<String, Object> parsed = Json.parseObject("{\"a\":\"Đà Lạt \\u00e9 \\\"q\\\"\",\"n\":[1,2.5,true,null]}");
        assertEquals("Đà Lạt é \"q\"", parsed.get("a"));
        assertEquals("{\"a\":\"Đà Lạt é \\\"q\\\"\",\"n\":[1,2.5,true,null]}", Json.stringify(parsed));
        assertThrows(Json.JsonException.class, () -> Json.parse("{\"a\":}"));
        assertThrows(Json.JsonException.class, () -> Json.parse("[1,2] x"));
        assertThrows(Json.JsonException.class, () -> Json.parse("[".repeat(200)));
    }
}
