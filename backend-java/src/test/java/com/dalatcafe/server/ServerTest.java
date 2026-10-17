package com.dalatcafe.server;

import com.dalatcafe.dao.DaoFactory;
import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.model.Customer;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.model.ReservationStatus;
import com.dalatcafe.model.Table;
import com.dalatcafe.model.TableStatus;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import com.dalatcafe.util.Json;
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
        // The config endpoint changes the Singleton; later tests expect the defaults.
        SystemConfigManager.getInstance().resetToDefaults();
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

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(HttpResponse<String> response) {
        return (Map<String, Object>) json(response).get("data");
    }

    private static double number(Map<String, Object> map, String key) {
        return ((Number) map.get(key)).doubleValue();
    }

    private String checkoutAtTable(int tableId, String extra) throws Exception {
        String body = "{\"tableId\":" + tableId + ",\"paymentMethod\":\"cash\",\"tenderedAmount\":200000,"
                + "\"lines\":[{\"menuItemId\":" + DRINK_ID + ",\"qty\":1,\"size\":\"L\"}]" + extra + "}";
        HttpResponse<String> response = call("POST", "/api/checkout", "STAFF", body);
        assertEquals(200, response.statusCode(), response.body());
        return (String) data(response).get("orderCode");
    }

    private HttpResponse<String> setOrderStatus(String code, String status) throws Exception {
        return call("PATCH", "/api/orders/" + code + "/status", "STAFF", "{\"status\":\"" + status + "\"}");
    }

    @Test
    void managerCreatesMenuItemAndStaffAdjustsStock() throws Exception {
        String item = "{\"name\":\"Tra atiso\",\"category\":\"Tea\",\"sellPrice\":39000,\"costPrice\":12000,"
                + "\"stockQty\":20,\"variations\":[{\"name\":\"It ngot\",\"price\":0}]}";
        assertEquals(401, call("POST", "/api/menu", null, item).statusCode());
        assertEquals(403, call("POST", "/api/menu", "STAFF", item).statusCode());
        HttpResponse<String> created = call("POST", "/api/menu", "MANAGER", item);
        assertEquals(201, created.statusCode(), created.body());
        int id = ((Number) data(created).get("id")).intValue();
        assertEquals(1, ((List<?>) data(created).get("variations")).size());
        assertEquals(409, call("POST", "/api/menu", "ADMIN", item).statusCode());
        assertEquals(400, call("POST", "/api/menu", "MANAGER", "{\"name\":\"X\",\"category\":\"Tea\"}").statusCode());
        assertTrue(call("GET", "/api/menu", null, null).body().contains("Tra atiso"));

        String stock = "/api/menu/" + id + "/stock";
        assertEquals(401, call("PATCH", stock, null, "{\"change\":-1}").statusCode());
        HttpResponse<String> used = call("PATCH", stock, "STAFF", "{\"change\":-3}");
        assertEquals(200, used.statusCode(), used.body());
        assertEquals(17.0, number(data(used), "stockQty"));
        assertEquals(409, call("PATCH", stock, "STAFF", "{\"change\":-100}").statusCode());
        HttpResponse<String> off = call("PATCH", stock, "STAFF", "{\"inStock\":false,\"stockQty\":5}");
        assertEquals(Boolean.FALSE, data(off).get("inStock"));
        assertEquals(5.0, number(data(off), "stockQty"));
        assertEquals(400, call("PATCH", stock, "STAFF", "{}").statusCode());
        assertEquals(400, call("PATCH", stock, "STAFF", "{\"change\":1,\"stockQty\":2}").statusCode());
        assertEquals(404, call("PATCH", "/api/menu/99999/stock", "STAFF", "{\"change\":1}").statusCode());
        assertEquals(405, call("DELETE", "/api/menu", "ADMIN", null).statusCode());
    }

    @Test
    void paidOrderSeatsTableAndKdsCompletionSendsItToCleaning() throws Exception {
        DaoFactory daos = DaoFactory.getInstance();
        String code = checkoutAtTable(3, "");
        assertEquals(TableStatus.OCCUPIED, daos.getTableDao().findById(3).orElseThrow().getStatus());

        HttpResponse<String> list = call("GET", "/api/orders?status=pending", "STAFF", null);
        assertEquals(200, list.statusCode(), list.body());
        assertTrue(list.body().contains(code));
        assertEquals(401, call("GET", "/api/orders", null, null).statusCode());
        assertEquals(400, call("GET", "/api/orders?status=lost", "STAFF", null).statusCode());

        assertEquals("brewing", data(setOrderStatus(code, "brewing")).get("status"));
        assertEquals("ready", data(setOrderStatus(code, "ready")).get("status"));
        assertEquals(TableStatus.OCCUPIED, daos.getTableDao().findById(3).orElseThrow().getStatus());
        HttpResponse<String> done = setOrderStatus(code, "completed");
        assertEquals(200, done.statusCode(), done.body());
        assertNotNull(data(done).get("completedAt"));
        Table table = daos.getTableDao().findById(3).orElseThrow();
        assertEquals(TableStatus.CLEANING, table.getStatus());
        assertEquals(0, table.getGuestCount());

        assertEquals(409, setOrderStatus(code, "brewing").statusCode());
        assertEquals(400, setOrderStatus(code, "lost").statusCode());
        assertEquals(404, setOrderStatus("AC-NOPE", "ready").statusCode());
    }

    @Test
    void ordersCannotMoveBackwardsAndCancellingPaidOrderRefundsIt() throws Exception {
        String code = checkoutAtTable(5, "");
        assertEquals(200, setOrderStatus(code, "ready").statusCode());
        HttpResponse<String> back = setOrderStatus(code, "brewing");
        assertEquals(409, back.statusCode());
        assertEquals("RESOURCE_CONFLICT", json(back).get("code"));
        HttpResponse<String> cancelled = setOrderStatus(code, "cancelled");
        assertEquals("cancelled", data(cancelled).get("status"));
        assertEquals("refunded", data(cancelled).get("paymentStatus"));
    }

    @Test
    void transferredOrderMustBePaidBeforeCompletion() throws Exception {
        String code = createReservation(10, 2);
        assertEquals(200, call("POST", "/api/reservations/" + code + "/transfer-pos", "STAFF", null).statusCode());

        assertEquals(409, setOrderStatus(code, "completed").statusCode());
        String pay = "/api/orders/" + code + "/pay";
        assertEquals(400, call("POST", pay, "STAFF", "{\"paymentMethod\":\"gold\"}").statusCode());
        dbUp.set(false);
        assertEquals(503, call("POST", pay, "STAFF", "{\"paymentMethod\":\"cash\"}").statusCode());
        dbUp.set(true);
        HttpResponse<String> paid = call("POST", pay, "STAFF", "{\"paymentMethod\":\"cash\"}");
        assertEquals(200, paid.statusCode(), paid.body());
        assertEquals("paid", data(paid).get("paymentStatus"));
        assertNotNull(data(paid).get("transactionId"));
        assertEquals(409, call("POST", pay, "STAFF", "{\"paymentMethod\":\"cash\"}").statusCode());
        assertEquals(404, call("POST", "/api/orders/AC-NOPE/pay", "STAFF", "{\"paymentMethod\":\"cash\"}").statusCode());
        assertEquals(200, setOrderStatus(code, "completed").statusCode());
        assertEquals(TableStatus.CLEANING, DaoFactory.getInstance().getTableDao().findById(10).orElseThrow().getStatus());
    }

    @Test
    void reservationStatusFollowsTheBookingLifecycle() throws Exception {
        String code = createReservation(6, 2);
        String path = "/api/reservations/" + code + "/status";
        assertEquals(401, call("PATCH", path, null, "{\"status\":\"confirmed\"}").statusCode());
        assertEquals(200, call("PATCH", path, "STAFF", "{\"status\":\"confirmed\"}").statusCode());
        assertEquals(ReservationStatus.CONFIRMED,
                DaoFactory.getInstance().getReservationDao().findByReservationCode(code).orElseThrow().getStatus());
        assertEquals(400, call("PATCH", path, "STAFF", "{\"status\":\"seated\"}").statusCode());
        assertEquals(200, call("PATCH", path, "STAFF", "{\"status\":\"cancelled\"}").statusCode());
        assertEquals(409, call("PATCH", path, "STAFF", "{\"status\":\"confirmed\"}").statusCode());
        assertEquals(409, call("POST", "/api/reservations/" + code + "/transfer-pos", "STAFF", null).statusCode());
        assertEquals(404, call("PATCH", "/api/reservations/RES-NOPE/status", "STAFF", "{\"status\":\"confirmed\"}").statusCode());
    }

    @Test
    void memberRedeemsLoyaltyPointsAtCheckout() throws Exception {
        Customer member = new Customer(null, "Tran Thu", "0988000111", "thu@example.com");
        member.setLoyaltyPoints(50);
        DaoFactory.getInstance().getCustomerDao().save(member);

        HttpResponse<String> lookup = call("GET", "/api/customers?phone=0988000111", "STAFF", null);
        assertEquals(200, lookup.statusCode(), lookup.body());
        List<?> found = (List<?>) json(lookup).get("data");
        assertEquals(1, found.size());
        assertEquals(401, call("GET", "/api/customers", null, null).statusCode());

        HttpResponse<String> response = call("POST", "/api/checkout", "STAFF",
                checkoutBody(1, ",\"customerPhone\":\"0988000111\",\"useLoyaltyPoints\":20"));
        assertEquals(200, response.statusCode(), response.body());
        Map<String, Object> receipt = data(response);
        assertEquals(20, ((Number) receipt.get("pointsRedeemed")).intValue());
        assertEquals(20_000.0, number(receipt, "pointsDiscountVnd"));
        assertEquals(20_000.0, number(receipt, "discountAmount"));
        assertEquals(37_800.0, number(receipt, "finalTotal"));
        int earned = ((Number) receipt.get("pointsEarned")).intValue();
        Customer after = DaoFactory.getInstance().getCustomerDao().findByPhone("0988000111").orElseThrow();
        assertEquals(50 - 20 + earned, after.getLoyaltyPoints());

        HttpResponse<String> tooMany = call("POST", "/api/checkout", "STAFF",
                checkoutBody(1, ",\"customerPhone\":\"0988000111\",\"useLoyaltyPoints\":999"));
        assertEquals(400, tooMany.statusCode());
        assertEquals("INSUFFICIENT_POINTS", json(tooMany).get("code"));
        assertEquals(400, call("POST", "/api/checkout", "STAFF", checkoutBody(1, ",\"useLoyaltyPoints\":5")).statusCode());
        assertEquals(400, call("POST", "/api/checkout", "STAFF",
                checkoutBody(1, ",\"customerPhone\":\"0988000111\",\"useLoyaltyPoints\":1.5")).statusCode());
    }

    @Test
    void redemptionNeverDiscountsMoreThanTheBill() throws Exception {
        Customer member = new Customer(null, "Vo Lan", "0988000222", null);
        member.setLoyaltyPoints(500);
        DaoFactory.getInstance().getCustomerDao().save(member);

        HttpResponse<String> response = call("POST", "/api/checkout", "STAFF",
                checkoutBody(1, ",\"customerPhone\":\"0988000222\",\"useLoyaltyPoints\":500"));
        assertEquals(200, response.statusCode(), response.body());
        Map<String, Object> receipt = data(response);
        assertEquals(55, ((Number) receipt.get("pointsRedeemed")).intValue());
        assertEquals(0.0, number(receipt, "finalTotal"));
        assertEquals(445, DaoFactory.getInstance().getCustomerDao().findByPhone("0988000222").orElseThrow().getLoyaltyPoints());
    }

    @Test
    void analyticsOverviewIsManagerOnly() throws Exception {
        checkoutAtTable(3, "");
        assertEquals(401, call("GET", "/api/analytics/overview", null, null).statusCode());
        assertEquals(403, call("GET", "/api/analytics/overview", "STAFF", null).statusCode());
        HttpResponse<String> response = call("GET", "/api/analytics/overview", "MANAGER", null);
        assertEquals(200, response.statusCode(), response.body());
        Map<String, Object> overview = data(response);
        assertTrue(number(overview, "totalRevenue") > 0);
        assertTrue(number(overview, "paidOrdersToday") >= 1);
        assertTrue(((List<?>) overview.get("topItems")).toString().contains("Ca phe muoi"));
        assertNotNull(overview.get("tables"));
        assertEquals(404, call("GET", "/api/analytics/other", "ADMIN", null).statusCode());
    }

    @Test
    void analyticsReturnsDailySeriesPaymentMixAndValidatesDays() throws Exception {
        checkoutAtTable(3, "");
        Map<String, Object> week = data(call("GET", "/api/analytics/overview", "MANAGER", null));
        List<?> series = (List<?>) week.get("revenueByDay");
        assertEquals(7, series.size());
        @SuppressWarnings("unchecked")
        Map<String, Object> today = (Map<String, Object>) series.get(6);
        assertTrue(number(today, "revenue") > 0);
        assertTrue(number(today, "orders") >= 1);
        @SuppressWarnings("unchecked")
        Map<String, Object> mix = (Map<String, Object>) week.get("paymentMix");
        assertTrue(number(mix, "cash") > 0);
        assertTrue(number(week, "ordersToday") >= 1);
        assertNotNull(week.get("fulfillmentMinutesToday"));

        assertEquals(3, ((List<?>) data(call("GET", "/api/analytics/overview?days=3", "ADMIN", null)).get("revenueByDay")).size());
        assertEquals(400, call("GET", "/api/analytics/overview?days=0", "MANAGER", null).statusCode());
        assertEquals(400, call("GET", "/api/analytics/overview?days=abc", "MANAGER", null).statusCode());
    }

    private static String offlineOrder(String code, String extra) {
        return "{\"orderCode\":\"" + code + "\",\"customer\":\"Khach offline\",\"orderType\":\"dine-in\","
                + "\"paymentMethod\":\"cash\",\"createdAt\":\"2026-10-17T02:00:00Z\"" + extra + "}";
    }

    @Test
    void offlineOrdersAreImportedOnceWithoutChargingAgain() throws Exception {
        DaoFactory daos = DaoFactory.getInstance();
        daos.getTableDao().updateStatus(12, TableStatus.AVAILABLE, 0);
        String batch = "{\"orders\":["
                + offlineOrder("AC-0901-OFF", ",\"tableId\":12,\"paid\":true,\"status\":\"pending\",\"total\":97200,"
                + "\"lines\":[{\"menuItemId\":" + DRINK_ID + ",\"name\":\"Ca phe muoi\",\"qty\":2,\"price\":45000}]") + ","
                + offlineOrder("AC-0902-OFF", ",\"orderType\":\"pickup\",\"paid\":false,"
                + "\"lines\":[{\"menuItemId\":99999,\"name\":\"Banh mi\",\"qty\":1,\"price\":20000}]") + ","
                + offlineOrder("AC-0903-OFF", ",\"paid\":false,\"status\":\"completed\","
                + "\"lines\":[{\"name\":\"Tra\",\"qty\":1,\"price\":20000}]") + ","
                + offlineOrder("AC-0904-OFF", ",\"paid\":true,\"lines\":[{\"name\":\"Tra\",\"qty\":0,\"price\":20000}]")
                + "]}";

        assertEquals(401, call("POST", "/api/orders/sync", null, batch).statusCode());
        HttpResponse<String> first = call("POST", "/api/orders/sync", "STAFF", batch);
        assertEquals(200, first.statusCode(), first.body());
        assertEquals(2, ((Number) data(first).get("created")).intValue());
        assertEquals(2, ((Number) data(first).get("failed")).intValue());
        assertTrue(first.body().contains("stock not deducted"));

        Order imported = daos.getOrderDao().findByOrderCode("AC-0901-OFF").orElseThrow();
        assertEquals(PaymentStatus.PAID, imported.getPaymentStatus());
        assertEquals(97_200, imported.getTotal());
        assertEquals("2026-10-17T02:00:00Z", imported.getCreatedAt().toString());
        assertEquals(8.0, daos.getMenuDao().findById(DRINK_ID).orElseThrow().getStockQty());
        assertEquals(TableStatus.OCCUPIED, daos.getTableDao().findById(12).orElseThrow().getStatus());
        assertEquals(PaymentStatus.UNPAID, daos.getOrderDao().findByOrderCode("AC-0902-OFF").orElseThrow().getPaymentStatus());
        assertTrue(daos.getOrderDao().findByOrderCode("AC-0903-OFF").isEmpty());

        HttpResponse<String> again = call("POST", "/api/orders/sync", "STAFF", batch);
        assertEquals(2, ((Number) data(again).get("existing")).intValue());
        assertEquals(0, ((Number) data(again).get("created")).intValue());
        assertEquals(8.0, daos.getMenuDao().findById(DRINK_ID).orElseThrow().getStockQty());

        // An imported order follows the normal KDS lifecycle afterwards.
        assertEquals(200, setOrderStatus("AC-0901-OFF", "completed").statusCode());
        assertEquals(TableStatus.CLEANING, daos.getTableDao().findById(12).orElseThrow().getStatus());

        assertEquals(400, call("POST", "/api/orders/sync", "STAFF", "{\"orders\":[]}").statusCode());
        dbUp.set(false);
        assertEquals(503, call("POST", "/api/orders/sync", "STAFF", batch).statusCode());
    }

    @Test
    void adminChangesStoreSettingsUsedByTheReservationChain() throws Exception {
        assertEquals(200, call("GET", "/api/config", "STAFF", null).statusCode());
        assertEquals(401, call("GET", "/api/config", null, null).statusCode());
        String change = "{\"maxReservationGuests\":4,\"openingTime\":\"08:00\",\"storeName\":\"Da Lat Cafe 2\"}";
        assertEquals(403, call("PUT", "/api/config", "MANAGER", change).statusCode());

        HttpResponse<String> updated = call("PUT", "/api/config", "ADMIN", change);
        assertEquals(200, updated.statusCode(), updated.body());
        assertEquals("08:00", data(updated).get("openingTime"));
        assertEquals("22:00", data(updated).get("closingTime"));
        assertEquals("Da Lat Cafe 2", SystemConfigManager.getInstance().getStoreName());

        // The Chain of Responsibility reads the Singleton: 5 guests now exceed the limit.
        String when = LocalDate.now().plusDays(2).atTime(LocalTime.of(15, 0)).toInstant(ZoneOffset.ofHours(7)).toString();
        HttpResponse<String> tooMany = call("POST", "/api/reservations", null, "{\"customer\":\"Lan\",\"contact\":\"0912000111\","
                + "\"dateTime\":\"" + when + "\",\"tableId\":5,\"guests\":5}");
        assertEquals(400, tooMany.statusCode());
        assertEquals("CHAIN_VALIDATION_FAILED", json(tooMany).get("code"));

        assertEquals(400, call("PATCH", "/api/config", "ADMIN", "{\"openingTime\":\"23:00\"}").statusCode());
        assertEquals(400, call("PATCH", "/api/config", "ADMIN", "{\"closingTime\":\"10pm\"}").statusCode());
        assertEquals(400, call("PATCH", "/api/config", "ADMIN", "{\"maxReservationGuests\":0}").statusCode());
        assertEquals(400, call("PATCH", "/api/config", "ADMIN", "{\"storeName\":\"\",\"maxReservationGuests\":9}").statusCode());
        assertEquals(4, SystemConfigManager.getInstance().getMaxReservationGuests(), "a rejected update changes nothing");
    }

    @Test
    void voucherValidationIsPublicAndMatchesCheckout() throws Exception {
        HttpResponse<String> ok = call("POST", "/api/vouchers/validate", null, "{\"code\":\"welcome10\",\"subtotal\":100000}");
        assertEquals(200, ok.statusCode(), ok.body());
        assertEquals(Boolean.TRUE, data(ok).get("valid"));
        assertEquals(10_000.0, number(data(ok), "discountAmount"));
        HttpResponse<String> capped = call("POST", "/api/vouchers/validate", null, "{\"code\":\"WELCOME10\",\"subtotal\":900000}");
        assertEquals(50_000.0, number(data(capped), "discountAmount"));
        HttpResponse<String> bad = call("POST", "/api/vouchers/validate", null, "{\"code\":\"NOPE\",\"subtotal\":100000}");
        assertEquals(Boolean.FALSE, data(bad).get("valid"));
        assertEquals(400, call("POST", "/api/vouchers/validate", null, "{\"code\":\"WELCOME10\"}").statusCode());
        // Only POST is public; any other method falls back to the staff gate first.
        assertEquals(401, call("GET", "/api/vouchers/validate", null, null).statusCode());
        assertEquals(405, call("GET", "/api/vouchers/validate", "STAFF", null).statusCode());
    }

    @Test
    void unknownEndpointsAreNotPublicByDefault() {
        assertEquals(SimpleAuthFilter.Access.PUBLIC, SimpleAuthFilter.required("GET", "/api/menu"));
        assertEquals(SimpleAuthFilter.Access.PUBLIC, SimpleAuthFilter.required("GET", "/api/menu/"));
        assertEquals(SimpleAuthFilter.Access.PUBLIC, SimpleAuthFilter.required("POST", "/api/reservations"));
        assertEquals(SimpleAuthFilter.Access.PUBLIC, SimpleAuthFilter.required("POST", "/api/vouchers/validate"));
        assertEquals(SimpleAuthFilter.Access.STAFF, SimpleAuthFilter.required("GET", "/api/anything-new"));
        assertEquals(SimpleAuthFilter.Access.MANAGER, SimpleAuthFilter.required("POST", "/api/menu"));
        assertEquals(SimpleAuthFilter.Access.STAFF, SimpleAuthFilter.required("PATCH", "/api/menu/1/stock"));
        assertEquals(SimpleAuthFilter.Access.ADMIN, SimpleAuthFilter.required("GET", "/api/users"));
        assertEquals(SimpleAuthFilter.Access.SIGNED_IN, SimpleAuthFilter.required("GET", "/api/auth/me"));
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
