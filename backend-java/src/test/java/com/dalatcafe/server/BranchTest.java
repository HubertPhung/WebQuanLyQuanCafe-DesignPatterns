package com.dalatcafe.server;

import com.dalatcafe.dao.DaoFactory;
import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.model.Branches;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.Table;
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

import static org.junit.jupiter.api.Assertions.*;

/** Tables, orders, bookings and analytics are kept apart per branch; the menu is shared. */
class BranchTest {
    private static final int DRINK_ID = 902;
    private static final String SECOND = Branches.BUI_THI_XUAN;

    private MainServer server;
    private HttpClient client;

    @BeforeEach
    void setUp() throws Exception {
        InMemoryDatabase.getInstance().reset();
        DaoFactory daos = DaoFactory.getInstance();
        MenuItem drink = new MenuItem(DRINK_ID, "Ca phe sua da", "Coffee", 40_000, 12_000);
        daos.getMenuDao().save(drink);
        server = new MainServer(0, daos, () -> true);
        server.start();
        client = HttpClient.newHttpClient();
    }

    @AfterEach
    void tearDown() {
        server.stop();
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
    private static Object data(HttpResponse<String> response) {
        return ((Map<String, Object>) Json.parse(response.body())).get("data");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> rows(HttpResponse<String> response) {
        return (List<Map<String, Object>>) data(response);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> object(HttpResponse<String> response) {
        return (Map<String, Object>) data(response);
    }

    private static int secondBranchTable() {
        return DaoFactory.getInstance().getTableDao().findAll().stream()
                .filter(t -> SECOND.equals(t.getBranch())).findFirst().orElseThrow().getId();
    }

    private static String inTwoDays(int hour) {
        return LocalDate.now().plusDays(2).atTime(LocalTime.of(hour, 0)).toInstant(ZoneOffset.ofHours(7)).toString();
    }

    @Test
    void floorPlanAndCatalogAreFilteredByBranch() throws Exception {
        List<Map<String, Object>> all = rows(call("GET", "/api/tables", "STAFF", null));
        List<Map<String, Object>> first = rows(call("GET", "/api/tables?branch=" + Branches.PHAN_DINH_PHUNG, "STAFF", null));
        List<Map<String, Object>> second = rows(call("GET", "/api/tables?branch=" + SECOND, "STAFF", null));

        assertEquals(all.size(), first.size() + second.size());
        assertEquals(15, first.size());
        assertEquals(8, second.size());
        assertTrue(second.stream().allMatch(t -> SECOND.equals(t.get("branch"))));
        assertEquals(8, rows(call("GET", "/api/tables/catalog?branch=" + SECOND, null, null)).size());
        assertEquals(400, call("GET", "/api/tables?branch=da-nang", "STAFF", null).statusCode());
    }

    @Test
    void newTableJoinsTheRequestedBranchAndNamesRepeatAcrossBranches() throws Exception {
        String body = "{\"name\":\"Bàn 01\",\"seats\":2,\"zone\":\"Tầng 3\",\"branch\":\"" + SECOND + "\"}";
        // "Bàn 01" already exists at both branches.
        assertEquals(409, call("POST", "/api/tables", "MANAGER", body).statusCode());

        HttpResponse<String> created = call("POST", "/api/tables", "MANAGER", body.replace("Bàn 01", "Bàn 01 Tầng 3"));
        assertEquals(201, created.statusCode(), created.body());
        assertEquals(SECOND, object(created).get("branch"));
        int id = ((Number) object(created).get("id")).intValue();

        // Editing keeps the branch even when another one is sent.
        String moved = "{\"name\":\"Bàn 01 Tầng 3\",\"seats\":4,\"zone\":\"Tầng 3\",\"branch\":\"" + Branches.PHAN_DINH_PHUNG + "\"}";
        HttpResponse<String> edited = call("PUT", "/api/tables/" + id + "/details", "MANAGER", moved);
        assertEquals(200, edited.statusCode(), edited.body());
        assertEquals(SECOND, object(edited).get("branch"));

        HttpResponse<String> sameNameFirstBranch = call("POST", "/api/tables", "MANAGER", moved);
        assertEquals(201, sameNameFirstBranch.statusCode(), sameNameFirstBranch.body());
        assertEquals(Branches.PHAN_DINH_PHUNG, object(sameNameFirstBranch).get("branch"));
        assertEquals(400, call("POST", "/api/tables", "MANAGER", moved.replace(Branches.PHAN_DINH_PHUNG, "x")).statusCode());
    }

    @Test
    void checkoutTakesTheBranchOfItsTableOrTheOneItNames() throws Exception {
        int table = secondBranchTable();
        String line = "\"lines\":[{\"menuItemId\":" + DRINK_ID + ",\"qty\":1}]";

        HttpResponse<String> dineIn = call("POST", "/api/checkout", "STAFF",
                "{\"tableId\":" + table + ",\"paymentMethod\":\"card\"," + line + "}");
        assertEquals(200, dineIn.statusCode(), dineIn.body());
        String dineInCode = (String) object(dineIn).get("orderCode");
        assertEquals(SECOND, DaoFactory.getInstance().getOrderDao().findByOrderCode(dineInCode).orElseThrow().getBranch());

        HttpResponse<String> pickup = call("POST", "/api/checkout", "STAFF",
                "{\"orderType\":\"pickup\",\"branch\":\"" + SECOND + "\",\"paymentMethod\":\"card\"," + line + "}");
        assertEquals(200, pickup.statusCode(), pickup.body());
        Order pickedUp = DaoFactory.getInstance().getOrderDao().findByOrderCode((String) object(pickup).get("orderCode")).orElseThrow();
        assertEquals(SECOND, pickedUp.getBranch());

        HttpResponse<String> unnamed = call("POST", "/api/checkout", "STAFF",
                "{\"orderType\":\"pickup\",\"paymentMethod\":\"card\"," + line + "}");
        Order defaulted = DaoFactory.getInstance().getOrderDao().findByOrderCode((String) object(unnamed).get("orderCode")).orElseThrow();
        assertEquals(Branches.DEFAULT, defaulted.getBranch());

        int ordersBefore = DaoFactory.getInstance().getOrderDao().findAll().size();
        HttpResponse<String> mismatch = call("POST", "/api/checkout", "STAFF", "{\"tableId\":" + table
                + ",\"branch\":\"" + Branches.PHAN_DINH_PHUNG + "\",\"paymentMethod\":\"card\"," + line + "}");
        assertEquals(400, mismatch.statusCode(), mismatch.body());
        assertEquals(ordersBefore, DaoFactory.getInstance().getOrderDao().findAll().size(), "nothing is charged or saved");

        List<Map<String, Object>> secondOrders = rows(call("GET", "/api/orders?branch=" + SECOND, "STAFF", null));
        assertEquals(2, secondOrders.size());
        assertTrue(secondOrders.stream().allMatch(o -> SECOND.equals(o.get("branch"))));
    }

    @Test
    void bookingTakesItsTablesBranchAndTransfersToAnOrderThere() throws Exception {
        List<Table> second = DaoFactory.getInstance().getTableDao().findAll().stream()
                .filter(t -> SECOND.equals(t.getBranch())).toList();
        String booking = "{\"customer\":\"Khach BTX\",\"contact\":\"0911000777\",\"dateTime\":\"" + inTwoDays(10)
                + "\",\"tableIds\":[" + second.get(0).getId() + "," + second.get(1).getId() + "],\"guests\":4,\"branch\":\"" + SECOND + "\"}";
        HttpResponse<String> created = call("POST", "/api/reservations", null, booking);
        assertEquals(201, created.statusCode(), created.body());
        String code = (String) object(created).get("id");

        List<Map<String, Object>> listed = rows(call("GET", "/api/reservations?branch=" + SECOND, "STAFF", null));
        assertEquals(List.of(code), listed.stream().map(r -> r.get("id")).toList());
        assertTrue(rows(call("GET", "/api/reservations?branch=" + Branches.PHAN_DINH_PHUNG, "STAFF", null)).stream()
                .noneMatch(r -> code.equals(r.get("id"))));

        HttpResponse<String> transferred = call("POST", "/api/reservations/" + code + "/transfer-pos", "STAFF", null);
        assertEquals(200, transferred.statusCode(), transferred.body());
        assertEquals(SECOND, object(transferred).get("branch"));

        // Tables of both branches cannot be joined, and a booking cannot name another branch's table.
        int firstBranchTable = 9;
        String mixed = booking.replace("0911000777", "0911000778").replace(inTwoDays(10), inTwoDays(15))
                .replace("[" + second.get(0).getId() + ",", "[" + firstBranchTable + ",");
        assertEquals(400, call("POST", "/api/reservations", null, mixed).statusCode());
        String wrongBranch = "{\"customer\":\"Khach PDP\",\"contact\":\"0911000779\",\"dateTime\":\"" + inTwoDays(16)
                + "\",\"tableId\":" + firstBranchTable + ",\"guests\":2,\"branch\":\"" + SECOND + "\"}";
        assertEquals(400, call("POST", "/api/reservations", null, wrongBranch).statusCode());
    }

    @Test
    void analyticsCountOnlyTheChosenBranch() throws Exception {
        String line = "\"lines\":[{\"menuItemId\":" + DRINK_ID + ",\"qty\":1}]";
        assertEquals(200, call("POST", "/api/checkout", "STAFF",
                "{\"orderType\":\"pickup\",\"branch\":\"" + SECOND + "\",\"paymentMethod\":\"card\"," + line + "}").statusCode());

        Map<String, Object> second = object(call("GET", "/api/analytics/overview?branch=" + SECOND, "MANAGER", null));
        Map<String, Object> whole = object(call("GET", "/api/analytics/overview", "MANAGER", null));
        assertEquals(1, ((Number) second.get("paidOrders")).intValue());
        assertTrue(((Number) whole.get("paidOrders")).intValue() > 1, "the seeded paid order is at the first branch");
        @SuppressWarnings("unchecked")
        Map<String, Object> tables = (Map<String, Object>) second.get("tables");
        assertEquals(8, ((Number) tables.get("total")).intValue());
        assertEquals(400, call("GET", "/api/analytics/overview?branch=nowhere", "MANAGER", null).statusCode());
    }

    @Test
    void offlineOrdersImportIntoTheirBranch() throws Exception {
        int table = secondBranchTable();
        String batch = "{\"orders\":["
                + "{\"orderCode\":\"AC-BR-0001\",\"tableId\":" + table + ",\"paid\":true,\"createdAt\":\"2026-10-17T02:00:00Z\","
                + "\"lines\":[{\"name\":\"Tra\",\"qty\":1,\"price\":20000}]},"
                + "{\"orderCode\":\"AC-BR-0002\",\"orderType\":\"pickup\",\"branch\":\"" + SECOND + "\",\"paid\":true,"
                + "\"createdAt\":\"2026-10-17T02:00:00Z\",\"lines\":[{\"name\":\"Tra\",\"qty\":1,\"price\":20000}]}]}";
        HttpResponse<String> response = call("POST", "/api/orders/sync", "STAFF", batch);
        assertEquals(200, response.statusCode(), response.body());
        assertEquals(SECOND, DaoFactory.getInstance().getOrderDao().findByOrderCode("AC-BR-0001").orElseThrow().getBranch());
        assertEquals(SECOND, DaoFactory.getInstance().getOrderDao().findByOrderCode("AC-BR-0002").orElseThrow().getBranch());
    }
}
