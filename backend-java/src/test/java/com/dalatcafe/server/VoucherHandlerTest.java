package com.dalatcafe.server;

import com.dalatcafe.dao.DaoFactory;
import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.model.Voucher;
import com.dalatcafe.security.AuthSettings;
import com.dalatcafe.security.PasswordHasher;
import com.dalatcafe.util.Json;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** API quản lý voucher: CRUD cho MANAGER, danh sách công khai, kiểm tra, giữ và nhả lượt cho storefront. */
class VoucherHandlerTest {
    private static final String SERVICE_KEY = "voucher-test-service-key";
    private static final LocalDate TODAY = LocalDate.now(Voucher.CAFE_ZONE);

    private MainServer server;
    private HttpClient client;

    @BeforeEach
    void setUp() throws Exception {
        InMemoryDatabase.getInstance().reset();
        AuthSettings auth = new AuthSettings("voucher-test-secret-0123456789-0123456789".getBytes(StandardCharsets.UTF_8),
                SERVICE_KEY, true, Duration.ofHours(1));
        server = new MainServer(0, DaoFactory.getInstance(), () -> true, auth, new PasswordHasher(10_000));
        server.start();
        client = HttpClient.newHttpClient();
    }

    @AfterEach
    void tearDown() {
        server.stop();
    }

    private HttpResponse<String> call(String method, String path, String role, String body, String... headers) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + server.getPort() + path))
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
        if (role != null) builder.header("X-User-Role", role);
        if (body != null) builder.header("Content-Type", "application/json");
        for (int i = 0; i + 1 < headers.length; i += 2) builder.header(headers[i], headers[i + 1]);
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private HttpResponse<String> service(String path, String body) throws Exception {
        return call("POST", path, null, body, "X-Service-Key", SERVICE_KEY);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(HttpResponse<String> response) {
        return (Map<String, Object>) ((Map<String, Object>) Json.parse(response.body())).get("data");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(HttpResponse<String> response) {
        return (List<Map<String, Object>>) ((Map<String, Object>) Json.parse(response.body())).get("data");
    }

    private static double number(Map<String, Object> map, String key) {
        return ((Number) map.get(key)).doubleValue();
    }

    private static String voucherJson(String code, String extra) {
        return "{\"code\":\"" + code + "\",\"type\":\"FIXED\",\"value\":10000,\"minOrder\":0,"
                + "\"startDate\":\"" + TODAY.minusDays(1) + "\",\"endDate\":\"" + TODAY.plusDays(30) + "\""
                + extra + "}";
    }

    private int create(String code, String extra) throws Exception {
        HttpResponse<String> created = call("POST", "/api/vouchers", "MANAGER", voucherJson(code, extra));
        assertEquals(201, created.statusCode(), created.body());
        return (int) number(data(created), "id");
    }

    private Map<String, Object> find(String code) throws Exception {
        return list(call("GET", "/api/vouchers", "MANAGER", null)).stream()
                .filter(v -> code.equals(v.get("code"))).findFirst().orElseThrow();
    }

    private void redeem(String code, String orderCode) throws Exception {
        HttpResponse<String> redeemed = service("/api/vouchers/redeem",
                "{\"code\":\"" + code + "\",\"subtotal\":100000,\"orderCode\":\"" + orderCode + "\"}");
        assertEquals(200, redeemed.statusCode(), redeemed.body());
    }

    @Test
    void managerCreatesListsUpdatesVoucher() throws Exception {
        HttpResponse<String> created = call("POST", "/api/vouchers", "MANAGER", voucherJson("sale1111", ""));
        assertEquals(201, created.statusCode(), created.body());
        assertEquals("SALE1111", data(created).get("code"));
        int id = (int) number(data(created), "id");
        assertEquals("RUNNING", find("SALE1111").get("state"));
        assertNull(find("SALE1111").get("maxUses"));

        HttpResponse<String> updated = call("PUT", "/api/vouchers/" + id, "MANAGER", voucherJson("SALE1111", ",\"minOrder\":50000"));
        assertEquals(200, updated.statusCode(), updated.body());
        assertEquals(50_000, number(find("SALE1111"), "minOrder"));
    }

    @Test
    void rejectsInvalidPayloads() throws Exception {
        assertEquals(400, call("POST", "/api/vouchers", "MANAGER",
                voucherJson("SALE120", "").replace("\"FIXED\",\"value\":10000", "\"PERCENT\",\"value\":120")).statusCode());
        assertEquals(400, call("POST", "/api/vouchers", "MANAGER", "{\"code\":\"BACKWARDS\",\"type\":\"FIXED\",\"value\":1000,"
                + "\"startDate\":\"" + TODAY + "\",\"endDate\":\"" + TODAY.minusDays(1) + "\"}").statusCode());
        assertEquals(400, call("POST", "/api/vouchers", "MANAGER", voucherJson("ab", "")).statusCode());
        assertEquals(400, call("POST", "/api/vouchers", "MANAGER", voucherJson("ZEROLIMIT", ",\"maxUses\":0")).statusCode());
        // Phần trăm phải từ 1 đến 100 như spec; 0.5% bị từ chối dù lớn hơn 0.
        assertEquals(400, call("POST", "/api/vouchers", "MANAGER",
                voucherJson("HALFPCT", "").replace("\"FIXED\",\"value\":10000", "\"PERCENT\",\"value\":0.5")).statusCode());
        create("SALE1111", "");
        assertEquals(409, call("POST", "/api/vouchers", "MANAGER", voucherJson("sale1111", "")).statusCode());
    }

    @Test
    void rejectsMaxUsesBelowUsedCount() throws Exception {
        int id = create("SALE1111", ",\"maxUses\":5");
        redeem("SALE1111", "ORD-1");
        redeem("SALE1111", "ORD-2");
        HttpResponse<String> lowered = call("PUT", "/api/vouchers/" + id, "MANAGER", voucherJson("SALE1111", ",\"maxUses\":1"));
        assertEquals(400, lowered.statusCode(), lowered.body());
        assertEquals(5, number(find("SALE1111"), "maxUses"));
        assertEquals(2, number(find("SALE1111"), "usedCount"));
    }

    @Test
    void deleteUnusedRemovesUsedDeactivates() throws Exception {
        int unused = create("UNUSED", "");
        HttpResponse<String> removed = call("DELETE", "/api/vouchers/" + unused, "MANAGER", null);
        assertEquals(200, removed.statusCode(), removed.body());
        assertEquals(Boolean.TRUE, data(removed).get("deleted"));

        int used = create("USED", "");
        redeem("USED", "ORD-9");
        HttpResponse<String> deactivated = call("DELETE", "/api/vouchers/" + used, "MANAGER", null);
        assertEquals(Boolean.FALSE, data(deactivated).get("deleted"));
        assertEquals(Boolean.TRUE, data(deactivated).get("deactivated"));
        assertEquals(Boolean.FALSE, find("USED").get("active"));
        assertEquals("DISABLED", find("USED").get("state"));
    }

    @Test
    void renamingUsedCodeIsRejected() throws Exception {
        int id = create("SALE1111", "");
        redeem("SALE1111", "ORD-1");
        assertEquals(409, call("PUT", "/api/vouchers/" + id, "MANAGER", voucherJson("SALE2222", "")).statusCode());
    }

    @Test
    void usagesListWhoUsedTheCode() throws Exception {
        int id = create("SALE1111", "");
        HttpResponse<String> redeemed = service("/api/vouchers/redeem",
                "{\"code\":\"SALE1111\",\"subtotal\":100000,\"userId\":7,\"orderCode\":\"WEB-1\"}");
        assertEquals(200, redeemed.statusCode(), redeemed.body());
        List<Map<String, Object>> usages = list(call("GET", "/api/vouchers/" + id + "/usages", "MANAGER", null));
        assertEquals(1, usages.size());
        assertEquals("WEB-1", usages.get(0).get("orderCode"));
        assertEquals(7, number(usages.get(0), "userId"));
    }

    @Test
    void activeListsOnlyRunning() throws Exception {
        create("RUNNING1", "");
        int off = create("OFF1", "");
        Map<String, Object> disabled = find("OFF1");
        call("PUT", "/api/vouchers/" + off, "MANAGER", voucherJson("OFF1", ",\"active\":false"));
        call("POST", "/api/vouchers", "MANAGER", "{\"code\":\"OLD1\",\"type\":\"FIXED\",\"value\":1000,"
                + "\"startDate\":\"" + TODAY.minusDays(10) + "\",\"endDate\":\"" + TODAY.minusDays(1) + "\"}");
        create("ONCE1", ",\"maxUses\":1");
        redeem("ONCE1", "ORD-1");
        assertNotNull(disabled);

        HttpResponse<String> active = call("GET", "/api/vouchers/active", null, null);
        assertEquals(200, active.statusCode(), active.body());
        List<Object> codes = list(active).stream().map(v -> v.get("code")).map(Object.class::cast).toList();
        assertTrue(codes.contains("RUNNING1"));
        assertTrue(codes.contains("WELCOME10"));
        assertFalse(codes.contains("OFF1"));
        assertFalse(codes.contains("OLD1"));
        assertFalse(codes.contains("ONCE1"));
        assertFalse(list(active).get(0).containsKey("usedCount"), "public list must not leak usage counts");
    }

    @Test
    void validateReportsReasonAndShortfall() throws Exception {
        create("MIN150", ",\"minOrder\":150000");
        HttpResponse<String> below = call("POST", "/api/vouchers/validate", null, "{\"code\":\"min150\",\"subtotal\":120000}");
        assertEquals(200, below.statusCode(), below.body());
        assertEquals(Boolean.FALSE, data(below).get("valid"));
        assertEquals("BELOW_MIN_ORDER", data(below).get("reason"));
        assertEquals(30_000, number(data(below), "shortfall"));
    }

    @Test
    void validateTrustsUserIdOnlyFromStorefront() throws Exception {
        HttpResponse<String> anonymous = call("POST", "/api/vouchers/validate", null,
                "{\"code\":\"WELCOME10\",\"subtotal\":100000,\"userId\":7}");
        assertEquals("LOGIN_REQUIRED", data(anonymous).get("reason"));
        HttpResponse<String> storefront = service("/api/vouchers/validate", "{\"code\":\"WELCOME10\",\"subtotal\":900000,\"userId\":7}");
        assertEquals(Boolean.TRUE, data(storefront).get("valid"), storefront.body());
        assertEquals(50_000, number(data(storefront), "discountAmount"));
        assertEquals(Boolean.TRUE, data(storefront).get("firstOnlineOrderOnly"));
    }

    @Test
    void redeemAndReleaseNeedServiceKey() throws Exception {
        create("SALE1111", "");
        String body = "{\"code\":\"SALE1111\",\"subtotal\":100000,\"orderCode\":\"WEB-5\"}";
        assertEquals(401, call("POST", "/api/vouchers/redeem", null, body).statusCode());
        assertEquals(403, call("POST", "/api/vouchers/redeem", "MANAGER", body).statusCode());
        HttpResponse<String> redeemed = service("/api/vouchers/redeem", body);
        assertEquals(200, redeemed.statusCode(), redeemed.body());
        assertTrue(number(data(redeemed), "usageId") > 0);
        assertEquals(10_000, number(data(redeemed), "discountAmount"));

        HttpResponse<String> released = service("/api/vouchers/release", "{\"orderCode\":\"WEB-5\"}");
        assertEquals(Boolean.TRUE, data(released).get("released"));
        assertEquals(Boolean.FALSE, data(service("/api/vouchers/release", "{\"orderCode\":\"WEB-5\"}")).get("released"));
        assertEquals(0, number(find("SALE1111"), "usedCount"));
    }

    @Test
    void redeemFailureIsInvalidVoucher() throws Exception {
        create("ONCE1", ",\"maxUses\":1");
        redeem("ONCE1", "ORD-1");
        HttpResponse<String> soldOut = service("/api/vouchers/redeem", "{\"code\":\"ONCE1\",\"subtotal\":100000,\"orderCode\":\"ORD-2\"}");
        assertEquals(400, soldOut.statusCode());
        assertTrue(soldOut.body().contains("INVALID_VOUCHER"));
    }

    @Test
    void staffCannotManageVouchers() throws Exception {
        assertEquals(403, call("GET", "/api/vouchers", "STAFF", null).statusCode());
        assertEquals(403, call("POST", "/api/vouchers", "STAFF", voucherJson("SALE1111", "")).statusCode());
        assertEquals(401, call("GET", "/api/vouchers", null, null).statusCode());
    }

    @Test
    void staffCannotReachVoucherIdsSpelledDifferently() throws Exception {
        // Integer.parseInt nhận "+1" và chữ số không phải ASCII; quyền không được phụ thuộc cách viết id.
        String welcome = voucherJson("WELCOME10", ",\"minOrder\":999999");
        assertEquals(403, call("PUT", "/api/vouchers/+1", "STAFF", welcome).statusCode());
        assertEquals(403, call("DELETE", "/api/vouchers/+1", "STAFF", null).statusCode());
        assertEquals(403, call("GET", "/api/vouchers/+1/usages", "STAFF", null).statusCode());
        assertEquals(403, call("PUT", "/api/vouchers/%D9%A1", "STAFF", welcome).statusCode());
        assertEquals(0, number(find("WELCOME10"), "minOrder"));
        // MANAGER dùng id lạ thì nhận 404, không được hiểu là voucher số 1.
        assertEquals(404, call("PUT", "/api/vouchers/+1", "MANAGER", welcome).statusCode());
        // Các đường dẫn công khai và của storefront vẫn giữ quyền cũ.
        assertEquals(200, call("GET", "/api/vouchers/active", null, null).statusCode());
        assertEquals(405, call("GET", "/api/vouchers/validate", "STAFF", null).statusCode());
    }
}
