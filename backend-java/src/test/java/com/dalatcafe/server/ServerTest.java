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
        MenuItem drink = new MenuItem(DRINK_ID, "Ca phe muoi", "Coffee", 45_000, 15_000);
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
        // Endpoint cài đặt làm thay đổi Singleton; các test sau cần giá trị mặc định.
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
        return "{\"paymentMethod\":\"cash\",\"tenderedAmount\":200000,"
                + "\"lines\":[{\"menuItemId\":" + DRINK_ID + ",\"qty\":" + qty + ",\"size\":\"L\"}]" + extra + "}";
    }

    @Test
    void managerCanCreateEditAndDeleteTableWithImage() throws Exception {
        String details = "{\"name\":\"Ban test CRUD\",\"seats\":4,\"zone\":\"San vuon\",\"imageUrl\":\"/images/space/counter.jpg\"}";
        assertEquals(403, call("POST", "/api/tables", "STAFF", details).statusCode());
        HttpResponse<String> created = call("POST", "/api/tables", "MANAGER", details);
        assertEquals(201, created.statusCode(), created.body());
        int id = ((Number) data(created).get("id")).intValue();
        assertEquals("/images/space/counter.jpg", data(created).get("imageUrl"));
        assertEquals(409, call("POST", "/api/tables", "MANAGER", details).statusCode());
        HttpResponse<String> updated = call("PUT", "/api/tables/" + id + "/details", "MANAGER", details.replace("San vuon", "Tang 2"));
        assertEquals(200, updated.statusCode(), updated.body());
        assertEquals("Tang 2", data(updated).get("zone"));
        assertEquals("/images/space/counter.jpg", DaoFactory.getInstance().getTableDao().findById(id).orElseThrow().getImageUrl());
        assertEquals(200, call("DELETE", "/api/tables/" + id, "MANAGER", null).statusCode());
        assertTrue(DaoFactory.getInstance().getTableDao().findById(id).isEmpty());
    }

    @Test
    void tableDetailsRejectRemoteImages() throws Exception {
        for (String image : java.util.List.of("https://example.com/table.jpg", "//example.com/table.jpg")) {
            String details = "{\"name\":\"Ban local image\",\"seats\":4,\"zone\":\"Main\",\"imageUrl\":\"" + image + "\"}";
            assertEquals(400, call("POST", "/api/tables", "MANAGER", details).statusCode(), image);
        }
    }

    @Test
    void tableDetailsRejectInvalidFieldsAndUsedTablesCannotBeDeleted() throws Exception {
        String details = "{\"name\":\"Ban test\",\"seats\":0,\"zone\":\"Main\",\"imageUrl\":null}";
        assertEquals(400, call("POST", "/api/tables", "MANAGER", details).statusCode());
        assertEquals(400, call("POST", "/api/tables", "MANAGER", details.replace("\"seats\":0", "\"seats\":4").replace("null", "\"javascript:alert(1)\"")).statusCode());
        assertEquals(409, call("DELETE", "/api/tables/2", "MANAGER", null).statusCode());
        assertEquals(404, call("DELETE", "/api/tables/99999", "MANAGER", null).statusCode());
    }

    @Test
    void deliveryCheckoutChargesTenThousandAndPickupHasNoShippingFee() throws Exception {
        HttpResponse<String> delivery = call("POST", "/api/checkout", "STAFF", checkoutBody(1, ",\"orderType\":\"delivery\""));
        assertEquals(200, delivery.statusCode(), delivery.body());
        assertEquals(10000, number(data(delivery), "shippingFee"));
        HttpResponse<String> pickup = call("POST", "/api/checkout", "STAFF", checkoutBody(1, ",\"orderType\":\"pickup\""));
        assertEquals(200, pickup.statusCode(), pickup.body());
        assertEquals(0, number(data(pickup), "shippingFee"));
        assertEquals(10000, number(data(delivery), "finalTotal") - number(data(pickup), "finalTotal"));
    }

    @Test
    void welcomeVoucherCannotBeRedeemedDirectlyAtPos() throws Exception {
        HttpResponse<String> response = call("POST", "/api/checkout", "STAFF", checkoutBody(1, ",\"voucherCode\":\"WELCOME10\""));
        assertEquals(400, response.statusCode(), response.body());
        assertEquals("INVALID_VOUCHER", json(response).get("code"));
    }

    @Test
    void groupedReservationValidatesAllTablesAndSeatsTheWholeGroup() throws Exception {
        DaoFactory daos = DaoFactory.getInstance();
        daos.getTableDao().save(new com.dalatcafe.model.Table(98001, "Group A", 4, "Garden"));
        daos.getTableDao().save(new com.dalatcafe.model.Table(98002, "Group B", 4, "Garden"));
        String date = LocalDate.now().plusDays(2).atTime(10, 0).toInstant(ZoneOffset.ofHours(7)).toString();
        String booking = "{\"customer\":\"Group guest\",\"contact\":\"0901234567\",\"dateTime\":\"" + date
                + "\",\"guests\":6,\"tableIds\":[98001,98002],\"preOrders\":[{\"menuItemId\":" + DRINK_ID + ",\"qty\":1}]}";
        assertEquals(400, call("POST", "/api/reservations", null, booking.replace("98001,98002", "98001,98001")).statusCode());
        assertEquals(400, call("POST", "/api/reservations", null, booking.replace("98001,98002", "98001")).statusCode());
        HttpResponse<String> created = call("POST", "/api/reservations", null, booking);
        assertEquals(201, created.statusCode(), created.body());
        assertEquals(400, call("POST", "/api/reservations", null, booking.replace("98001,98002", "98002").replace("\"guests\":6", "\"guests\":2")).statusCode());
        String edit = "{\"name\":\"Group A updated\",\"seats\":4,\"zone\":\"Garden\",\"imageUrl\":null}";
        assertEquals(200, call("PUT", "/api/tables/98001/details", "MANAGER", edit).statusCode());
        assertEquals(400, call("PUT", "/api/tables/98001/details", "MANAGER", edit.replace("\"seats\":4", "\"seats\":1")).statusCode());
        assertEquals(409, call("DELETE", "/api/tables/98002", "MANAGER", null).statusCode(), "An active reservation on a secondary table must block archiving");
        String code = (String) data(created).get("id");
        makeReservationDue(code);
        HttpResponse<String> transferred = call("POST", "/api/reservations/" + code + "/transfer-pos", "STAFF", null);
        assertEquals(200, transferred.statusCode(), transferred.body());
        assertEquals(List.of(98001.0, 98002.0), data(transferred).get("tableIds"));
        assertEquals(com.dalatcafe.model.TableStatus.OCCUPIED, daos.getTableDao().findById(98002).orElseThrow().getStatus());
        assertEquals(1, daos.getOrderDao().findByTableId(98002).size());
        HttpResponse<String> catalog = call("GET", "/api/tables/catalog", null, null);
        assertEquals(200, catalog.statusCode());
        assertFalse(catalog.body().contains("guestCount"));
    }

    @Test
    void noShowExpiryUsesAppointmentTimeAndDoesNotCancelSeatedGuests() {
        DaoFactory daos = DaoFactory.getInstance();
        ReservationHandler handler = new ReservationHandler(daos.getReservationDao(), daos.getTableDao(), daos.getOrderDao(), daos.getMenuDao());
        java.time.Instant now = java.time.Instant.now();
        handler.expireNoShows(now);
        for (int i = 0; i < 3; i++) {
            com.dalatcafe.model.Reservation reservation = new com.dalatcafe.model.Reservation();
            reservation.setReservationCode("NOSHOW-" + i);
            reservation.setCustomer("No show test"); reservation.setContact("0901234567");
            reservation.setTableId(1);
            // Phiếu chưa nhận bàn được giữ 30 phút tính từ giờ khách đến.
            reservation.setDateTime(now.minusSeconds(i == 1 ? 1799 : 1800));
            reservation.setStatus(i == 2 ? ReservationStatus.SEATED : ReservationStatus.CONFIRMED);
            assertTrue(daos.getReservationDao().save(reservation));
        }
        assertEquals(1, handler.expireNoShows(now));
        assertEquals(ReservationStatus.CANCELLED, daos.getReservationDao().findByReservationCode("NOSHOW-0").orElseThrow().getStatus());
        assertEquals(ReservationStatus.CONFIRMED, daos.getReservationDao().findByReservationCode("NOSHOW-1").orElseThrow().getStatus());
        assertEquals(ReservationStatus.SEATED, daos.getReservationDao().findByReservationCode("NOSHOW-2").orElseThrow().getStatus());
        assertEquals(0, handler.expireNoShows(now));
    }

    @Test
    void groupPaymentChargesOnceAndRejectsShortCashStaleTotalAndRepeatPayment() throws Exception {
        DaoFactory daos = DaoFactory.getInstance();
        for (int id : List.of(98003, 98004)) {
            daos.getTableDao().save(new com.dalatcafe.model.Table(id, "Payment " + id, 4, "Garden"));
            Order order = new Order(null, "GROUP-" + id, "Group buyer", id, com.dalatcafe.model.OrderType.DINE_IN);
            order.addItem(new com.dalatcafe.model.OrderItem(DRINK_ID, "Drink", 1, 50000, null, null));
            assertTrue(daos.getOrderDao().save(order));
        }
        String body = "{\"tableIds\":[98003,98004],\"paymentMethod\":\"cash\",\"tenderedAmount\":1000}";
        assertEquals(400, call("POST", "/api/orders/pay-tables", "STAFF", body).statusCode());
        assertEquals(409, call("POST", "/api/orders/pay-tables", "STAFF", body.replace("1000", "200000").replace("}", ",\"expectedTotal\":1}")).statusCode());
        HttpResponse<String> paid = call("POST", "/api/orders/pay-tables", "STAFF", body.replace("1000", "200000"));
        assertEquals(200, paid.statusCode(), paid.body());
        assertEquals(108000, number(data(paid), "total"));
        assertEquals(409, call("POST", "/api/orders/pay-tables", "STAFF", body.replace("1000", "200000")).statusCode());
        assertTrue(daos.getOrderDao().findByOrderCode("GROUP-98003").orElseThrow().getPaymentStatus() == com.dalatcafe.model.PaymentStatus.PAID);
        assertTrue(daos.getOrderDao().findByOrderCode("GROUP-98004").orElseThrow().getPaymentStatus() == com.dalatcafe.model.PaymentStatus.PAID);
    }

    @Test
    void archivedTableDisappearsWhileCompletedOrderHistoryRemains() throws Exception {
        DaoFactory daos = DaoFactory.getInstance();
        int id = 98501;
        daos.getTableDao().save(new Table(id, "Old table", 4, "Archive test"));
        Order order = new Order(null, "ARCHIVE-HISTORY", "Buyer", id, com.dalatcafe.model.OrderType.DINE_IN);
        order.setStatus(com.dalatcafe.model.OrderStatus.COMPLETED);
        order.setPaymentStatus(PaymentStatus.PAID);
        assertTrue(daos.getOrderDao().save(order));
        HttpResponse<String> result = call("DELETE", "/api/tables/" + id, "MANAGER", null);
        assertEquals(200, result.statusCode(), result.body());
        assertTrue(daos.getTableDao().findById(id).isEmpty());
        assertTrue(daos.getTableDao().findAll().stream().noneMatch(table -> table.getId() == id));
        assertTrue(daos.getTableDao().findByZone("Archive test").isEmpty());
        assertEquals(id, daos.getOrderDao().findByOrderCode("ARCHIVE-HISTORY").orElseThrow().getTableId());
        assertFalse(daos.getTableDao().updateStatus(id, TableStatus.AVAILABLE, 0));
        HttpResponse<String> replacement = call("POST", "/api/tables", "MANAGER", "{\"name\":\"New table\",\"seats\":4,\"zone\":\"Archive test\"}");
        assertEquals(201, replacement.statusCode(), replacement.body());
        assertTrue(((Number) data(replacement).get("id")).intValue() > id);
    }

    @Test
    void unfinishedOrUnpaidGroupOrderPreventsArchivingSecondaryTable() throws Exception {
        DaoFactory daos = DaoFactory.getInstance();
        daos.getTableDao().save(new Table(98502, "Group first", 4, "Archive test"));
        daos.getTableDao().save(new Table(98503, "Group second", 4, "Archive test"));
        Order order = new Order(null, "ARCHIVE-OPEN", "Buyer", 98502, com.dalatcafe.model.OrderType.DINE_IN);
        order.setTableIds(List.of(98502, 98503));
        order.setStatus(com.dalatcafe.model.OrderStatus.COMPLETED);
        assertTrue(daos.getOrderDao().save(order));
        assertEquals(409, call("DELETE", "/api/tables/98503", "MANAGER", null).statusCode());
        order.setPaymentStatus(PaymentStatus.PAID);
        assertTrue(daos.getOrderDao().save(order));
        assertEquals(200, call("DELETE", "/api/tables/98503", "MANAGER", null).statusCode());
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
    void reservationInThePastFailsTheChainAndIsNotStored() throws Exception {
        String when = LocalDate.now().minusDays(2).atTime(LocalTime.of(15, 0)).toInstant(ZoneOffset.ofHours(7)).toString();
        String body = "{\"customer\":\"An\",\"contact\":\"0912345678\",\"dateTime\":\"" + when
                + "\",\"tableId\":1,\"guests\":2}";
        HttpResponse<String> response = call("POST", "/api/reservations", null, body);
        assertEquals(400, response.statusCode());
        assertEquals("CHAIN_VALIDATION_FAILED", json(response).get("code"));
        HttpResponse<String> stored = call("GET", "/api/reservations", "STAFF", null);
        assertEquals(200, stored.statusCode());
        assertFalse(stored.body().contains(when));
    }

    @Test
    void validReservationIsCreated() throws Exception {
        String when = LocalDate.now().plusDays(2).atTime(LocalTime.of(15, 0)).toInstant(ZoneOffset.ofHours(7)).toString();
        String body = "{\"customer\":\"An\",\"contact\":\"0912345678\",\"dateTime\":\"" + when
                + "\",\"tableId\":1,\"guests\":2,\"preOrders\":[{\"menuItemId\":2,\"qty\":2}]}";
        HttpResponse<String> response = call("POST", "/api/reservations", null, body);
        assertEquals(201, response.statusCode(), response.body());
        assertEquals(Boolean.TRUE, json(response).get("ok"));
        assertEquals(200, call("GET", "/api/reservations", "STAFF", null).statusCode());
    }

    @Test
    @SuppressWarnings("unchecked")
    void publicAvailabilityBlocksAllGroupedTablesButAllowsOtherTablesAndAdjacentSlots() throws Exception {
        var slot = LocalDate.now().plusDays(2).atTime(10, 0).toInstant(ZoneOffset.ofHours(7));
        String body = "{\"customer\":\"Schedule guest\",\"contact\":\"0912345678\",\"dateTime\":\"" + slot
                + "\",\"tableIds\":[3,4],\"guests\":2}";
        var created = call("POST", "/api/reservations", null, body);
        assertEquals(201, created.statusCode(), created.body());
        String code = (String) data(created).get("id");
        String catalog = "/api/tables/catalog?dateTime=" + java.net.URLEncoder.encode(slot.toString(), StandardCharsets.UTF_8);
        var response = call("GET", catalog, null, null);
        assertEquals(200, response.statusCode(), response.body());
        var tables = (List<Map<String, Object>>) json(response).get("data");
        for (int id : List.of(3, 4, 5)) {
            var table = tables.stream().filter(row -> ((Number) row.get("id")).intValue() == id).findFirst().orElseThrow();
            assertEquals(id == 5, table.get("available"));
        }
        assertFalse(response.body().contains("0912345678"));
        assertFalse(response.body().contains("Schedule guest"));
        assertEquals(400, call("POST", "/api/reservations", null, body.replace("[3,4]", "[4,5]")).statusCode());
        assertEquals(201, call("POST", "/api/reservations", null, body.replace("[3,4]", "[5]")).statusCode());
        String adjacent = body.replace(slot.toString(), slot.plus(com.dalatcafe.patterns.chain.TableAvailabilityValidator.DEFAULT_DURATION).toString());
        assertEquals(201, call("POST", "/api/reservations", null, adjacent).statusCode());
        assertEquals(200, call("PATCH", "/api/reservations/" + code + "/status", "STAFF", "{\"status\":\"cancelled\"}").statusCode());
        tables = (List<Map<String, Object>>) json(call("GET", catalog, null, null)).get("data");
        assertTrue(tables.stream().filter(row -> List.of(3, 4).contains(((Number) row.get("id")).intValue()))
                .allMatch(row -> Boolean.TRUE.equals(row.get("available"))));
        assertEquals(400, call("GET", "/api/tables/catalog?dateTime=invalid", null, null).statusCode());
    }

    @Test
    @SuppressWarnings("unchecked")
    void arrivalGraceExpiresUnseatedBookingsButKeepsSeatedTablesUnavailable() throws Exception {
        var reservations = DaoFactory.getInstance().getReservationDao();
        String waiting = createReservation(3, 2);
        var waitingBooking = reservations.findByReservationCode(waiting).orElseThrow();
        String seated = createReservation(4, 2);
        assertEquals(200, call("POST", "/api/reservations/" + seated + "/transfer-pos", "STAFF", null).statusCode());
        var seatedBooking = reservations.findByReservationCode(seated).orElseThrow();
        waitingBooking.setDateTime(java.time.Instant.now().minusSeconds(31 * 60));
        seatedBooking.setDateTime(java.time.Instant.now().minusSeconds(31 * 60));
        var slot = java.net.URLEncoder.encode(java.time.Instant.now().toString(), StandardCharsets.UTF_8);
        var response = call("GET", "/api/tables/catalog?dateTime=" + slot, null, null);
        assertEquals(200, response.statusCode(), response.body());
        var tables = (List<Map<String, Object>>) json(response).get("data");
        assertEquals(true, tables.stream().filter(row -> ((Number) row.get("id")).intValue() == 3).findFirst().orElseThrow().get("available"));
        assertEquals(false, tables.stream().filter(row -> ((Number) row.get("id")).intValue() == 4).findFirst().orElseThrow().get("available"));
        assertEquals(ReservationStatus.SEATED, seatedBooking.getStatus());
        assertFalse(seatedBooking.isNoShowAt(java.time.Instant.now(), 15));
        var arrival = java.time.Instant.now().plusSeconds(3600);
        waitingBooking.setDateTime(arrival);
        assertFalse(waitingBooking.isNoShowAt(arrival.plusSeconds(15 * 60).minusMillis(1), 15));
        assertTrue(waitingBooking.isNoShowAt(arrival.plusSeconds(15 * 60), 15));
    }

    private String createReservation(int tableId, int guests) throws Exception {
        String when = LocalDate.now().plusDays(2).atTime(LocalTime.of(10, 0)).toInstant(ZoneOffset.ofHours(7)).toString();
        String body = "{\"customer\":\"Binh\",\"contact\":\"0911222333\",\"dateTime\":\"" + when + "\",\"tableId\":" + tableId
                + ",\"guests\":" + guests + ",\"preOrders\":[{\"menuItemId\":2,\"qty\":2}]}";
        HttpResponse<String> created = call("POST", "/api/reservations", null, body);
        assertEquals(201, created.statusCode(), created.body());
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) json(created).get("data");
        String code = (String) data.get("id");
        makeReservationDue(code);
        return code;
    }

    private void makeReservationDue(String code) {
        DaoFactory.getInstance().getReservationDao().findByReservationCode(code).orElseThrow()
                .setDateTime(java.time.Instant.now());
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
    void preOrdersArePricedFromTheMenuNotFromTheClient() throws Exception {
        String when = LocalDate.now().plusDays(2).atTime(LocalTime.of(11, 0)).toInstant(ZoneOffset.ofHours(7)).toString();
        String body = "{\"customer\":\"Chi\",\"contact\":\"0911000444\",\"dateTime\":\"" + when + "\",\"tableId\":11,\"guests\":2,"
                + "\"preOrders\":[{\"menuItemId\":2,\"name\":\"Free latte\",\"qty\":10,\"price\":0}]}";
        HttpResponse<String> created = call("POST", "/api/reservations", null, body);
        assertEquals(201, created.statusCode(), created.body());
        @SuppressWarnings("unchecked")
        String code = (String) ((Map<String, Object>) json(created).get("data")).get("id");

        makeReservationDue(code);
        HttpResponse<String> transfer = call("POST", "/api/reservations/" + code + "/transfer-pos", "STAFF", null);
        assertEquals(200, transfer.statusCode(), transfer.body());
        @SuppressWarnings("unchecked")
        Map<String, Object> order = (Map<String, Object>) json(transfer).get("data");
        @SuppressWarnings("unchecked")
        Map<String, Object> line = (Map<String, Object>) ((List<?>) order.get("items")).get(0);
        assertEquals(2, ((Number) line.get("menuItemId")).intValue());
        assertEquals("Cà phê Latte Vani Mịn", line.get("name"));
        assertEquals(55_000.0, ((Number) line.get("price")).doubleValue());
        assertEquals(550_000.0, ((Number) order.get("subtotal")).doubleValue());
    }

    @Test
    void preOrdersMustNameAnExistingMenuItem() throws Exception {
        String when = LocalDate.now().plusDays(2).atTime(LocalTime.of(12, 0)).toInstant(ZoneOffset.ofHours(7)).toString();
        String prefix = "{\"customer\":\"Dung\",\"contact\":\"0911000555\",\"dateTime\":\"" + when + "\",\"tableId\":5,\"guests\":2,";

        HttpResponse<String> unknown = call("POST", "/api/reservations", null, prefix + "\"preOrders\":[{\"menuItemId\":9999,\"qty\":1}]}");
        assertEquals(400, unknown.statusCode(), unknown.body());
        HttpResponse<String> byName = call("POST", "/api/reservations", null,
                prefix + "\"preOrders\":[{\"name\":\"Latte\",\"qty\":1,\"price\":1}]}");
        assertEquals(400, byName.statusCode(), byName.body());
        assertFalse(call("GET", "/api/reservations", "STAFF", null).body().contains("0911000555"));
        assertEquals(201, call("POST", "/api/reservations", null, prefix + "\"preOrders\":[{\"menuItemId\":1,\"qty\":1}]}").statusCode());
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
    }

    @Test
    void checkoutRejectsBadRequestsWithStandardCodes() throws Exception {
        assertEquals(401, call("POST", "/api/checkout", null, checkoutBody(1, "")).statusCode());
        assertEquals(403, call("POST", "/api/checkout", "CUSTOMER", checkoutBody(1, "")).statusCode());
        DaoFactory.getInstance().getMenuDao().toggleInStock(DRINK_ID, false);
        assertEquals(409, call("POST", "/api/checkout", "STAFF", checkoutBody(1, "")).statusCode());
        DaoFactory.getInstance().getMenuDao().toggleInStock(DRINK_ID, true);
        HttpResponse<String> voucher = call("POST", "/api/checkout", "STAFF", checkoutBody(1, ",\"voucherCode\":\"NOPE\""));
        assertEquals(400, voucher.statusCode());
        assertEquals("INVALID_VOUCHER", json(voucher).get("code"));
        assertEquals(400, call("POST", "/api/checkout", "STAFF", "{\"paymentMethod\":\"cash\",\"lines\":[]}").statusCode());
        assertEquals(405, call("GET", "/api/checkout", "STAFF", null).statusCode());
    }

    @Test
    void checkoutAtAnUnknownTableIsRejectedBeforeTakingPayment() throws Exception {
        int ordersBefore = DaoFactory.getInstance().getOrderDao().findAll().size();
        HttpResponse<String> response = call("POST", "/api/checkout", "STAFF", "{\"tableId\":999,\"paymentMethod\":\"cash\","
                + "\"lines\":[{\"menuItemId\":" + DRINK_ID + ",\"qty\":1}]}");

        assertEquals(404, response.statusCode(), response.body());
        assertEquals(ordersBefore, DaoFactory.getInstance().getOrderDao().findAll().size());
    }

    @Test
    void cashShortOfTheTotalIsRejectedBeforeTakingPayment() throws Exception {
        int ordersBefore = DaoFactory.getInstance().getOrderDao().findAll().size();
        HttpResponse<String> response = call("POST", "/api/checkout", "STAFF", "{\"paymentMethod\":\"cash\","
                + "\"tenderedAmount\":1000,\"lines\":[{\"menuItemId\":" + DRINK_ID + ",\"qty\":1}]}");

        assertEquals(400, response.statusCode(), response.body());
        assertEquals("INVALID_INPUT", json(response).get("code"));
        assertEquals(ordersBefore, DaoFactory.getInstance().getOrderDao().findAll().size());
        assertEquals(400, call("POST", "/api/checkout", "STAFF", "{\"paymentMethod\":\"cash\",\"tenderedAmount\":-5,"
                + "\"lines\":[{\"menuItemId\":" + DRINK_ID + ",\"qty\":1}]}").statusCode());
    }

    @Test
    void checkoutReturns503WhenDatabaseIsDown() throws Exception {
        dbUp.set(false);
        HttpResponse<String> response = call("POST", "/api/checkout", "STAFF", checkoutBody(1, ""));
        assertEquals(503, response.statusCode());
        assertEquals("DATABASE_UNAVAILABLE", json(response).get("code"));
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

    // Hóa đơn cũ/được nhập có thể dùng chung bàn; hóa đơn POS mới phải chọn bàn chưa dùng.
    private String historicalPaidOrderAtTable(int tableId, String code) {
        Order order = new Order(null, code, "Existing guest", tableId, com.dalatcafe.model.OrderType.DINE_IN);
        order.addItem(new com.dalatcafe.model.OrderItem("Coffee", 1, 45000));
        order.setPaymentStatus(PaymentStatus.PAID);
        assertTrue(DaoFactory.getInstance().getOrderDao().save(order));
        return code;
    }

    @Test
    @SuppressWarnings("unchecked")
    void unpaidImportedOrderOccupiesEveryTableAndBlocksAnotherCheckout() throws Exception {
        DaoFactory daos = DaoFactory.getInstance();
        String batch = "{\"orders\":[" + offlineOrder("UNPAID-GROUP", ",\"tableId\":3,\"tableIds\":[3,6],\"paid\":false,"
                + "\"lines\":[{\"name\":\"Coffee\",\"qty\":1,\"price\":45000}]") + "]}";
        HttpResponse<String> imported = call("POST", "/api/orders/sync", "STAFF", batch);
        assertEquals(200, imported.statusCode(), imported.body());
        assertEquals(1, ((Number) data(imported).get("created")).intValue());
        assertEquals(TableStatus.OCCUPIED, daos.getTableDao().findById(3).orElseThrow().getStatus());
        assertEquals(TableStatus.OCCUPIED, daos.getTableDao().findById(6).orElseThrow().getStatus());
        assertEquals(PaymentStatus.UNPAID, daos.getOrderDao().findByOrderCode("UNPAID-GROUP").orElseThrow().getPaymentStatus());
        // Cờ trạng thái bàn cũ hoặc đặt tay không được che mất đơn đang mở.
        daos.getTableDao().updateStatus(3, TableStatus.AVAILABLE, 0);
        List<Map<String, Object>> tables = (List<Map<String, Object>>) json(call("GET", "/api/tables", "STAFF", null)).get("data");
        assertEquals("occupied", tables.stream().filter(table -> ((Number) table.get("id")).intValue() == 3).findFirst().orElseThrow().get("status"));
        int before = daos.getOrderDao().findAll().size();
        HttpResponse<String> rejected = call("POST", "/api/checkout", "STAFF", checkoutBody(1, ",\"tableId\":3"));
        assertEquals(409, rejected.statusCode(), rejected.body());
        assertEquals("TABLE_UNAVAILABLE", json(rejected).get("code"));
        assertEquals(before, daos.getOrderDao().findAll().size(), "No second order or payment is created");
        assertEquals(409, call("POST", "/api/checkout", "STAFF", checkoutBody(1, ",\"tableId\":6")).statusCode());
    }

    @Test
    void concurrentNewCheckoutsAtOneTableOnlyCreateOneOrder() throws Exception {
        String body = checkoutBody(1, ",\"tableId\":3");
        var first = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            try { return call("POST", "/api/checkout", "STAFF", body).statusCode(); }
            catch (Exception error) { throw new RuntimeException(error); }
        });
        var second = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
            try { return call("POST", "/api/checkout", "STAFF", body).statusCode(); }
            catch (Exception error) { throw new RuntimeException(error); }
        });
        assertEquals(List.of(200, 409), java.util.stream.Stream.of(first.join(), second.join()).sorted().toList());
    }

    private HttpResponse<String> setOrderStatus(String code, String status) throws Exception {
        return call("PATCH", "/api/orders/" + code + "/status", "STAFF", "{\"status\":\"" + status + "\"}");
    }

    @Test
    void managerCreatesMenuItemAndStaffSwitchesItOffSale() throws Exception {
        String item = "{\"name\":\"Tra atiso\",\"category\":\"Tea\",\"sellPrice\":39000,\"costPrice\":12000,"
                + "\"variations\":[{\"name\":\"It ngot\",\"price\":0}]}";
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
        assertEquals(Boolean.TRUE, data(created).get("inStock"), "a new item is on sale");
        assertFalse(data(created).containsKey("stockQty"));
        assertEquals(401, call("PATCH", stock, null, "{\"inStock\":false}").statusCode());
        HttpResponse<String> off = call("PATCH", stock, "STAFF", "{\"inStock\":false}");
        assertEquals(200, off.statusCode(), off.body());
        assertEquals(Boolean.FALSE, data(off).get("inStock"));
        assertEquals(400, call("PATCH", stock, "STAFF", "{}").statusCode());
        assertEquals(400, call("PATCH", stock, "STAFF", "{\"change\":-1}").statusCode());
        assertEquals(404, call("PATCH", "/api/menu/99999/stock", "STAFF", "{\"inStock\":true}").statusCode());
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
    void completingOneOrderKeepsTheTableSeatedWhileAnotherOrderIsOpen() throws Exception {
        DaoFactory daos = DaoFactory.getInstance();
        String first = checkoutAtTable(3, "");
        String second = historicalPaidOrderAtTable(3, "HISTORY-SECOND");
        String cancelled = historicalPaidOrderAtTable(3, "HISTORY-CANCELLED");
        assertEquals(200, setOrderStatus(cancelled, "cancelled").statusCode());

        assertEquals(200, setOrderStatus(first, "completed").statusCode());
        assertEquals(TableStatus.OCCUPIED, daos.getTableDao().findById(3).orElseThrow().getStatus());

        assertEquals(200, setOrderStatus(second, "completed").statusCode());
        Table table = daos.getTableDao().findById(3).orElseThrow();
        assertEquals(TableStatus.CLEANING, table.getStatus());
        assertEquals(0, table.getGuestCount());
    }

    @Test
    void anUnpaidOpenTabKeepsTheTableSeated() throws Exception {
        // Dữ liệu mẫu: bàn 7 có khách và hóa đơn AC-0052-C3D của họ vẫn chưa thanh toán.
        DaoFactory daos = DaoFactory.getInstance();
        String extra = historicalPaidOrderAtTable(7, "HISTORY-EXTRA");
        assertEquals(200, setOrderStatus(extra, "completed").statusCode());
        assertEquals(TableStatus.OCCUPIED, daos.getTableDao().findById(7).orElseThrow().getStatus());

        HttpResponse<String> paid = call("POST", "/api/orders/AC-0052-C3D/pay", "STAFF", "{\"paymentMethod\":\"cash\"}");
        assertEquals(200, paid.statusCode(), paid.body());
        assertEquals(200, setOrderStatus("AC-0052-C3D", "completed").statusCode());
        assertEquals(TableStatus.CLEANING, daos.getTableDao().findById(7).orElseThrow().getStatus());
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
    void cancellingKitchenTicketAlsoCancelsItsSeatedReservation() throws Exception {
        String code = createReservation(10, 2);
        assertEquals(200, call("POST", "/api/reservations/" + code + "/transfer-pos", "STAFF", null).statusCode());
        assertEquals(200, setOrderStatus(code, "ready").statusCode());
        HttpResponse<String> cancelled = setOrderStatus(code, "cancelled");
        assertEquals(200, cancelled.statusCode(), cancelled.body());
        assertEquals("unpaid", data(cancelled).get("paymentStatus"));
        assertEquals(ReservationStatus.CANCELLED, DaoFactory.getInstance().getReservationDao().findByReservationCode(code).orElseThrow().getStatus());
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
        assertTrue(first.body().contains("without a menu link"));

        Order imported = daos.getOrderDao().findByOrderCode("AC-0901-OFF").orElseThrow();
        assertEquals(PaymentStatus.PAID, imported.getPaymentStatus());
        assertEquals(97_200, imported.getTotal());
        assertEquals("2026-10-17T02:00:00Z", imported.getCreatedAt().toString());
        assertEquals(TableStatus.OCCUPIED, daos.getTableDao().findById(12).orElseThrow().getStatus());
        assertEquals(PaymentStatus.UNPAID, daos.getOrderDao().findByOrderCode("AC-0902-OFF").orElseThrow().getPaymentStatus());
        assertTrue(daos.getOrderDao().findByOrderCode("AC-0903-OFF").isEmpty());

        HttpResponse<String> again = call("POST", "/api/orders/sync", "STAFF", batch);
        assertEquals(2, ((Number) data(again).get("existing")).intValue());
        assertEquals(0, ((Number) data(again).get("created")).intValue());

        // Đơn được nhập sau đó đi theo vòng đời KDS bình thường.
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

        // Chain of Responsibility đọc Singleton: giờ 5 khách đã vượt giới hạn.
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
        com.dalatcafe.model.Voucher sale = new com.dalatcafe.model.Voucher();
        sale.setCode("SALE10");
        sale.setType(com.dalatcafe.model.VoucherType.PERCENT);
        sale.setValue(10);
        sale.setMaxDiscount(50_000.0);
        sale.setStartDate(LocalDate.now(com.dalatcafe.model.Voucher.CAFE_ZONE).minusDays(1));
        sale.setEndDate(LocalDate.now(com.dalatcafe.model.Voucher.CAFE_ZONE).plusDays(1));
        assertTrue(DaoFactory.getInstance().getVoucherDao().save(sale));
        HttpResponse<String> ok = call("POST", "/api/vouchers/validate", null, "{\"code\":\"sale10\",\"subtotal\":100000}");
        assertEquals(200, ok.statusCode(), ok.body());
        assertEquals(Boolean.TRUE, data(ok).get("valid"));
        assertEquals(10_000.0, number(data(ok), "discountAmount"));
        HttpResponse<String> capped = call("POST", "/api/vouchers/validate", null, "{\"code\":\"SALE10\",\"subtotal\":900000}");
        assertEquals(50_000.0, number(data(capped), "discountAmount"));
        // WELCOME10 giới hạn mỗi tài khoản một lần, nên khách vãng lai phải đăng nhập.
        HttpResponse<String> welcome = call("POST", "/api/vouchers/validate", null, "{\"code\":\"WELCOME10\",\"subtotal\":100000}");
        assertEquals(Boolean.FALSE, data(welcome).get("valid"));
        assertEquals("LOGIN_REQUIRED", data(welcome).get("reason"));
        HttpResponse<String> bad = call("POST", "/api/vouchers/validate", null, "{\"code\":\"NOPE\",\"subtotal\":100000}");
        assertEquals(Boolean.FALSE, data(bad).get("valid"));
        assertEquals(400, call("POST", "/api/vouchers/validate", null, "{\"code\":\"WELCOME10\"}").statusCode());
        // Chỉ POST là công khai; phương thức khác phải qua cổng kiểm tra nhân viên trước.
        assertEquals(401, call("GET", "/api/vouchers/validate", null, null).statusCode());
        assertEquals(405, call("GET", "/api/vouchers/validate", "STAFF", null).statusCode());
    }

    @Test
    void unknownEndpointsAreNotPublicByDefault() {
        assertEquals(SimpleAuthFilter.Access.PUBLIC, SimpleAuthFilter.required("GET", "/api/menu"));
        assertEquals(SimpleAuthFilter.Access.PUBLIC, SimpleAuthFilter.required("GET", "/api/menu/"));
        assertEquals(SimpleAuthFilter.Access.PUBLIC, SimpleAuthFilter.required("POST", "/api/reservations"));
        assertEquals(SimpleAuthFilter.Access.PUBLIC, SimpleAuthFilter.required("POST", "/api/vouchers/validate"));
        assertEquals(SimpleAuthFilter.Access.PUBLIC, SimpleAuthFilter.required("GET", "/api/vouchers/active"));
        assertEquals(SimpleAuthFilter.Access.MANAGER, SimpleAuthFilter.required("POST", "/api/vouchers"));
        assertEquals(SimpleAuthFilter.Access.MANAGER, SimpleAuthFilter.required("GET", "/api/vouchers/3/usages"));
        assertEquals(SimpleAuthFilter.Access.STAFF, SimpleAuthFilter.required("GET", "/api/anything-new"));
        assertEquals(SimpleAuthFilter.Access.MANAGER, SimpleAuthFilter.required("POST", "/api/menu"));
        assertEquals(SimpleAuthFilter.Access.STAFF, SimpleAuthFilter.required("PATCH", "/api/menu/1/stock"));
        assertEquals(SimpleAuthFilter.Access.ADMIN, SimpleAuthFilter.required("GET", "/api/users"));
        assertEquals(SimpleAuthFilter.Access.SIGNED_IN, SimpleAuthFilter.required("GET", "/api/auth/me"));
    }

    @Test
    void onlyTheContextPathAndItsSubPathsBelongToAContext() {
        assertTrue(SimpleAuthFilter.withinContext("/api/users", "/api/users"));
        assertTrue(SimpleAuthFilter.withinContext("/api/users/", "/api/users"));
        assertTrue(SimpleAuthFilter.withinContext("/api/users/7", "/api/users"));
        assertFalse(SimpleAuthFilter.withinContext("/api/usersX", "/api/users"));
        assertFalse(SimpleAuthFilter.withinContext("/api/users-admin/7", "/api/users"));
        assertFalse(SimpleAuthFilter.withinContext("/api/configX", "/api/config"));
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
