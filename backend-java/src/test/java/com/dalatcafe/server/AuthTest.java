package com.dalatcafe.server;

import com.dalatcafe.dao.DaoFactory;
import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.model.UserRole;
import com.dalatcafe.security.AdminBootstrap;
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
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Đăng ký, đăng nhập, đăng nhập Google và phân quyền với access token thật: server chạy không có
 * lối tắt X-User-Role, đúng như production.
 */
class AuthTest {
    private static final String SECRET = "test-secret-that-is-long-enough-0123456789";
    private static final String SERVICE_KEY = "frontend-service-key";
    private static final String ADMIN_EMAIL = "boss@dalatcafe.vn";
    private static final String ADMIN_PASSWORD = "Boss12345";

    private MainServer server;
    private HttpClient client;

    @BeforeEach
    void setUp() throws Exception {
        InMemoryDatabase.getInstance().reset();
        DaoFactory daos = DaoFactory.getInstance();
        PasswordHasher hasher = new PasswordHasher(10_000);
        AdminBootstrap.ensureAdmin(daos.getUserDao(), hasher, Map.of("ADMIN_EMAIL", ADMIN_EMAIL, "ADMIN_PASSWORD", ADMIN_PASSWORD));
        AuthSettings auth = new AuthSettings(SECRET.getBytes(StandardCharsets.UTF_8), SERVICE_KEY, false, Duration.ofHours(1));
        server = new MainServer(0, daos, () -> true, auth, hasher);
        server.start();
        client = HttpClient.newHttpClient();
    }

    @AfterEach
    void tearDown() {
        server.stop();
    }

    private HttpResponse<String> call(String method, String path, String token, String body, String... headers) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + server.getPort() + path))
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (body != null) builder.header("Content-Type", "application/json");
        for (int i = 0; i + 1 < headers.length; i += 2) builder.header(headers[i], headers[i + 1]);
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(HttpResponse<String> response) {
        return (Map<String, Object>) ((Map<String, Object>) Json.parse(response.body())).get("data");
    }

    @SuppressWarnings("unchecked")
    private static String code(HttpResponse<String> response) {
        return (String) ((Map<String, Object>) Json.parse(response.body())).get("code");
    }

    @SuppressWarnings("unchecked")
    private static String role(HttpResponse<String> session) {
        return (String) ((Map<String, Object>) data(session).get("user")).get("role");
    }

    private String login(String email, String password) throws Exception {
        HttpResponse<String> response = call("POST", "/api/auth/login", null,
                "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
        assertEquals(200, response.statusCode(), response.body());
        return (String) data(response).get("token");
    }

    private int createUser(String adminToken, String email, String role) throws Exception {
        HttpResponse<String> created = call("POST", "/api/users", adminToken,
                "{\"email\":\"" + email + "\",\"name\":\"Nhan vien\",\"password\":\"Staff1234\",\"role\":\"" + role + "\"}");
        assertEquals(201, created.statusCode(), created.body());
        return ((Number) data(created).get("id")).intValue();
    }

    @Test
    void signUpCreatesCustomerWhoCannotUseStaffEndpoints() throws Exception {
        HttpResponse<String> signup = call("POST", "/api/auth/register", null,
                "{\"email\":\"An@Example.com\",\"name\":\"An\",\"password\":\"Coffee2026\"}");
        assertEquals(201, signup.statusCode(), signup.body());
        assertEquals("CUSTOMER", role(signup));
        String token = (String) data(signup).get("token");

        HttpResponse<String> me = call("GET", "/api/auth/me", token, null);
        assertEquals(200, me.statusCode());
        assertEquals("an@example.com", data(me).get("email"));
        assertEquals(403, call("GET", "/api/tables", token, null).statusCode());
        assertEquals(200, call("GET", "/api/menu", token, null).statusCode());

        assertEquals("EMAIL_TAKEN", code(call("POST", "/api/auth/register", null,
                "{\"email\":\"an@example.com\",\"name\":\"An 2\",\"password\":\"Coffee2026\"}")));
        assertEquals(400, call("POST", "/api/auth/register", null,
                "{\"email\":\"not-an-email\",\"name\":\"X\",\"password\":\"Coffee2026\"}").statusCode());
        assertEquals(400, call("POST", "/api/auth/register", null,
                "{\"email\":\"b@example.com\",\"name\":\"B\",\"password\":\"short1\"}").statusCode());
        assertEquals(400, call("POST", "/api/auth/register", null,
                "{\"email\":\"b@example.com\",\"name\":\"B\",\"password\":\"onlyletters\"}").statusCode());
    }

    @Test
    void customersSeeOnlyTheirReservationsIncludingLegacyEmailAndCancelledBookings() throws Exception {
        String admin = login(ADMIN_EMAIL, ADMIN_PASSWORD);
        int ownerId = createUser(admin, "booking-owner@example.com", "customer");
        int otherId = createUser(admin, "booking-other@example.com", "customer");
        String owner = login("booking-owner@example.com", "Staff1234");
        String other = login("booking-other@example.com", "Staff1234");
        String template = "{\"customer\":\"Booking test\",\"contact\":\"0901234567\",\"tableId\":3,\"guests\":2,\"dateTime\":\"%s\",\"email\":\"%s\",\"userId\":%d}";
        String slot = LocalDate.now().plusDays(2).atTime(10, 0).toInstant(ZoneOffset.ofHours(7)).toString();
        HttpResponse<String> created = call("POST", "/api/reservations", owner,
                template.formatted(slot, "booking-other@example.com", otherId));
        assertEquals(201, created.statusCode(), created.body());
        String ownCode = data(created).get("id").toString();
        var reservations = DaoFactory.getInstance().getReservationDao();
        assertEquals(ownerId, reservations.findByReservationCode(ownCode).orElseThrow().getUserId());
        reservations.updateStatus(reservations.findByReservationCode(ownCode).orElseThrow().getId(),
                com.dalatcafe.model.ReservationStatus.CANCELLED);

        String legacySlot = LocalDate.now().plusDays(2).atTime(12, 0).toInstant(ZoneOffset.ofHours(7)).toString();
        HttpResponse<String> legacy = call("POST", "/api/reservations", null,
                template.formatted(legacySlot, "BOOKING-OWNER@example.com", otherId));
        assertEquals(201, legacy.statusCode(), legacy.body());
        String legacyCode = data(legacy).get("id").toString();
        assertNull(reservations.findByReservationCode(legacyCode).orElseThrow().getUserId());

        String otherSlot = LocalDate.now().plusDays(2).atTime(14, 0).toInstant(ZoneOffset.ofHours(7)).toString();
        assertEquals(201, call("POST", "/api/reservations", other,
                template.formatted(otherSlot, "booking-owner@example.com", ownerId)).statusCode());

        assertEquals(401, call("GET", "/api/reservations/mine", null, null).statusCode());
        assertEquals(403, call("GET", "/api/reservations", owner, null).statusCode());
        HttpResponse<String> history = call("GET", "/api/reservations/mine?userId=" + otherId, owner, null);
        assertEquals(200, history.statusCode(), history.body());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) ((Map<?, ?>) Json.parse(history.body())).get("data");
        assertEquals(List.of(legacyCode, ownCode), rows.stream().map(row -> row.get("id")).toList());
        assertEquals("Đã hủy", rows.get(1).get("status"));
        assertEquals(405, call("POST", "/api/reservations/mine", owner, "{}").statusCode());

        var requests = new java.util.ArrayList<java.util.concurrent.CompletableFuture<HttpResponse<String>>>();
        for (int i = 0; i < 16; i++) {
            HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + server.getPort() + "/api/reservations/mine"))
                    .header("Authorization", "Bearer " + (i % 2 == 0 ? owner : other)).GET().build();
            requests.add(client.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)));
        }
        for (int i = 0; i < requests.size(); i++) {
            HttpResponse<String> response = requests.get(i).get(10, java.util.concurrent.TimeUnit.SECONDS);
            assertEquals(200, response.statusCode(), response.body());
            assertEquals(i % 2 == 0, response.body().contains(ownCode), "Concurrent accounts must keep separate histories");
        }
    }

    @Test
    void roleHeaderAloneIsIgnoredAndBadTokensAreRejected() throws Exception {
        assertEquals(401, call("GET", "/api/tables", null, null, "X-User-Role", "ADMIN").statusCode());
        assertEquals(401, call("GET", "/api/tables", "not.a.token", null).statusCode());
        String token = login(ADMIN_EMAIL, ADMIN_PASSWORD);
        String[] parts = token.split("\\.");
        String forged = parts[0] + "." + parts[1] + "." + parts[2].substring(0, parts[2].length() - 2) + "AA";
        assertEquals(401, call("GET", "/api/tables", forged, null).statusCode());
        String none = "eyJhbGciOiJub25lIn0." + parts[1] + ".";
        assertEquals(401, call("GET", "/api/tables", none, null).statusCode());
        assertEquals(401, call("GET", "/api/tables", null, null, "Authorization", "Basic YWRtaW46YWRtaW4=").statusCode());
        assertEquals(200, call("GET", "/api/tables", token, null).statusCode());
        // Token hết hạn không làm hỏng các endpoint công khai.
        assertEquals(200, call("GET", "/api/menu", forged, null).statusCode());
    }

    @Test
    void wrongPasswordsAreThrottledWithTheSameAnswerAsUnknownEmails() throws Exception {
        HttpResponse<String> unknown = call("POST", "/api/auth/login", null, "{\"email\":\"ghost@x.vn\",\"password\":\"Whatever1\"}");
        HttpResponse<String> wrong = call("POST", "/api/auth/login", null, "{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"Wrong1234\"}");
        assertEquals(401, unknown.statusCode());
        assertEquals(401, wrong.statusCode());
        assertEquals(code(unknown), code(wrong));
        for (int i = 0; i < 4; i++) {
            call("POST", "/api/auth/login", null, "{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"Wrong1234\"}");
        }
        HttpResponse<String> locked = call("POST", "/api/auth/login", null,
                "{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"" + ADMIN_PASSWORD + "\"}");
        assertEquals(429, locked.statusCode());
        assertEquals("TOO_MANY_ATTEMPTS", code(locked));
    }

    @Test
    void adminManagesStaffAndRoleChangesApplyToExistingTokens() throws Exception {
        String admin = login(ADMIN_EMAIL, ADMIN_PASSWORD);
        int staffId = createUser(admin, "barista@dalatcafe.vn", "staff");
        String staff = login("barista@dalatcafe.vn", "Staff1234");

        assertEquals(200, call("GET", "/api/tables", staff, null).statusCode());
        assertEquals(403, call("GET", "/api/users", staff, null).statusCode());
        assertEquals(403, call("GET", "/api/analytics/overview", staff, null).statusCode());
        assertEquals(403, call("PUT", "/api/config", staff, "{\"maxReservationGuests\":5}").statusCode());

        assertEquals(200, call("PATCH", "/api/users/" + staffId, admin, "{\"role\":\"manager\"}").statusCode());
        assertEquals(200, call("GET", "/api/analytics/overview", staff, null).statusCode(), "the same token now has MANAGER rights");

        assertEquals(200, call("PATCH", "/api/users/" + staffId, admin, "{\"active\":false}").statusCode());
        assertEquals(401, call("GET", "/api/tables", staff, null).statusCode(), "a disabled account loses access at once");
        HttpResponse<String> disabledLogin = call("POST", "/api/auth/login", null,
                "{\"email\":\"barista@dalatcafe.vn\",\"password\":\"Staff1234\"}");
        assertEquals(403, disabledLogin.statusCode());
        assertEquals("ACCOUNT_DISABLED", code(disabledLogin));

        assertEquals(400, call("POST", "/api/users", admin,
                "{\"email\":\"x@dalatcafe.vn\",\"name\":\"X\",\"password\":\"Staff1234\",\"role\":\"owner\"}").statusCode());
        assertEquals(409, call("POST", "/api/users", admin,
                "{\"email\":\"barista@dalatcafe.vn\",\"name\":\"X\",\"password\":\"Staff1234\",\"role\":\"staff\"}").statusCode());
        assertEquals(404, call("PATCH", "/api/users/999", admin, "{\"role\":\"staff\"}").statusCode());
    }

    @Test
    void passwordsWithSurroundingSpacesWorkExactlyAsTyped() throws Exception {
        assertEquals(201, call("POST", "/api/auth/register", null,
                "{\"email\":\"space@example.com\",\"name\":\"Space\",\"password\":\" Coffee2026 \"}").statusCode());
        String token = login("space@example.com", " Coffee2026 ");
        assertEquals(401, call("POST", "/api/auth/login", null,
                "{\"email\":\"space@example.com\",\"password\":\"Coffee2026\"}").statusCode(), "the trimmed password is a different one");

        assertEquals(200, call("POST", "/api/auth/password", token,
                "{\"currentPassword\":\" Coffee2026 \",\"newPassword\":\"Latte2026 \"}").statusCode());
        login("space@example.com", "Latte2026 ");
    }

    @Test
    void lookalikePathsDoNotSkipTheRoleCheck() throws Exception {
        String admin = login(ADMIN_EMAIL, ADMIN_PASSWORD);
        createUser(admin, "barista@dalatcafe.vn", "staff");
        String staff = login("barista@dalatcafe.vn", "Staff1234");

        // HttpServer giao "/api/usersX" cho handler "/api/users"; bộ lọc không được cho nó đi qua.
        assertEquals(404, call("GET", "/api/usersX", staff, null).statusCode());
        assertEquals(404, call("POST", "/api/usersX", staff,
                "{\"email\":\"evil@dalatcafe.vn\",\"name\":\"Evil\",\"password\":\"Staff1234\",\"role\":\"admin\"}").statusCode());
        assertEquals(401, call("POST", "/api/auth/login", null,
                "{\"email\":\"evil@dalatcafe.vn\",\"password\":\"Staff1234\"}").statusCode(), "no admin was created");
        assertEquals(404, call("PUT", "/api/configX", staff, "{\"maxReservationGuests\":5}").statusCode());
        assertEquals(404, call("POST", "/api/menuX", staff,
                "{\"name\":\"Lookalike\",\"category\":\"coffee\",\"price\":10000}").statusCode());
        assertEquals(404, call("POST", "/api/reservationsX", null, "{}").statusCode());
        // Các đường dẫn thật, có hay không có dấu / ở cuối, vẫn giữ quy tắc của chúng.
        assertEquals(403, call("PUT", "/api/config/", staff, "{\"maxReservationGuests\":5}").statusCode());
        assertEquals(200, call("GET", "/api/users/", admin, null).statusCode());
        assertEquals(200, call("GET", "/api/menu", null, null).statusCode());
    }

    @Test
    void lastAdminCannotBeDemotedOrDisabled() throws Exception {
        String admin = login(ADMIN_EMAIL, ADMIN_PASSWORD);
        int adminId = ((Number) data(call("GET", "/api/auth/me", admin, null)).get("id")).intValue();
        assertEquals(409, call("PATCH", "/api/users/" + adminId, admin, "{\"role\":\"staff\"}").statusCode());
        assertEquals(409, call("PATCH", "/api/users/" + adminId, admin, "{\"active\":false}").statusCode());

        int second = createUser(admin, "owner2@dalatcafe.vn", "admin");
        String other = login("owner2@dalatcafe.vn", "Staff1234");
        // Vẫn bị chặn khi tự làm với chính mình, được phép với quản trị viên khác miễn còn một quản
        // trị viên.
        assertEquals(409, call("PATCH", "/api/users/" + adminId, admin, "{\"role\":\"manager\"}").statusCode());
        assertEquals(200, call("PATCH", "/api/users/" + adminId, other, "{\"role\":\"manager\"}").statusCode());
        assertEquals(409, call("PATCH", "/api/users/" + second, other, "{\"active\":false}").statusCode());
    }

    @Test
    void storefrontServiceKeyMayOnlyPlaceAndSyncOrders() throws Exception {
        String checkout = "{\"lines\":[{\"menuItemId\":1,\"qty\":1}],\"orderType\":\"pickup\",\"paymentMethod\":\"qr\",\"customer\":\"Khach online\"}";
        assertEquals(401, call("POST", "/api/checkout", null, checkout).statusCode(), "a guest without the key");
        assertEquals(401, call("POST", "/api/checkout", null, checkout, "X-Service-Key", "guess").statusCode());
        HttpResponse<String> placed = call("POST", "/api/checkout", null, checkout, "X-Service-Key", SERVICE_KEY);
        assertEquals(200, placed.statusCode(), placed.body());

        String welcomeCheckout = checkout.replace("\"customer\":", "\"voucherCode\":\"WELCOME10\",\"customer\":");
        HttpResponse<String> welcome = call("POST", "/api/checkout", null, welcomeCheckout, "X-Service-Key", SERVICE_KEY);
        assertEquals(200, welcome.statusCode(), welcome.body());
        assertEquals(((Number) data(placed).get("finalTotal")).doubleValue() * 0.9,
                ((Number) data(welcome).get("finalTotal")).doubleValue(), 0.01);

        String sync = "{\"orders\":[{\"orderCode\":\"AC-SVC0-001\",\"customer\":\"Khach COD\",\"orderType\":\"pickup\","
                + "\"paymentMethod\":\"cash\",\"paid\":false,\"status\":\"pending\",\"createdAt\":\"2026-10-18T02:00:00Z\","
                + "\"total\":48600,\"lines\":[{\"menuItemId\":1,\"name\":\"Ca phe Muoi\",\"qty\":1,\"price\":45000}]}]}";
        HttpResponse<String> synced = call("POST", "/api/orders/sync", null, sync, "X-Service-Key", SERVICE_KEY);
        assertEquals(200, synced.statusCode(), synced.body());
        assertEquals(1, ((Number) data(synced).get("created")).intValue(), synced.body());

        // Key này không phải đăng nhập nhân viên: mọi endpoint nhân viên khác vẫn cần tài khoản đã
        // đăng nhập.
        assertEquals(401, call("GET", "/api/orders", null, null, "X-Service-Key", SERVICE_KEY).statusCode());
        assertEquals(401, call("PATCH", "/api/orders/AC-SVC0-001/status", null, "{\"status\":\"brewing\"}", "X-Service-Key", SERVICE_KEY).statusCode());
        assertEquals(401, call("GET", "/api/customers", null, null, "X-Service-Key", SERVICE_KEY).statusCode(),
                "the key may look up one phone, not list every member");
        assertEquals(401, call("GET", "/api/customers?phone=", null, null, "X-Service-Key", SERVICE_KEY).statusCode());
        HttpResponse<String> member = call("GET", "/api/customers?phone=0901234567", null, null, "X-Service-Key", SERVICE_KEY);
        assertEquals(200, member.statusCode(), "the account page reads the buyer's own points");
        assertEquals(401, call("GET", "/api/customers/1?phone=0901234567", null, null, "X-Service-Key", SERVICE_KEY).statusCode());
        // Token của chính khách hàng đã đăng nhập không thể tạo checkout của nhân viên, dù có hay
        // không có key.
        String customer = (String) data(call("POST", "/api/auth/register", null,
                "{\"email\":\"khach.online@example.com\",\"name\":\"Khach\",\"password\":\"Khach1234\"}")).get("token");
        assertEquals(403, call("POST", "/api/checkout", customer, checkout).statusCode());
        assertEquals(403, call("POST", "/api/checkout", customer, checkout, "X-Service-Key", SERVICE_KEY).statusCode());
    }

    @Test
    void googleSignInIsForCustomersAndNeedsTheServiceKey() throws Exception {
        String google = "{\"googleSubject\":\"1234567890\",\"email\":\"lan@gmail.com\",\"name\":\"Lan\",\"emailVerified\":true}";
        assertEquals(401, call("POST", "/api/auth/google", null, google).statusCode());
        assertEquals(401, call("POST", "/api/auth/google", null, google, "X-Service-Key", "guess").statusCode());

        HttpResponse<String> first = call("POST", "/api/auth/google", null, google, "X-Service-Key", SERVICE_KEY);
        assertEquals(201, first.statusCode(), first.body());
        assertEquals("CUSTOMER", role(first));
        HttpResponse<String> again = call("POST", "/api/auth/google", null, google, "X-Service-Key", SERVICE_KEY);
        assertEquals(200, again.statusCode());
        assertEquals(data(first).get("user").toString(), data(again).get("user").toString().replace(
                ((Map<?, ?>) data(again).get("user")).get("lastLoginAt").toString(),
                ((Map<?, ?>) data(first).get("user")).get("lastLoginAt").toString()));

        // Khách đã đăng ký bằng mật khẩu được liên kết với Google qua email đã xác minh.
        assertEquals(201, call("POST", "/api/auth/register", null,
                "{\"email\":\"mai@gmail.com\",\"name\":\"Mai\",\"password\":\"Coffee2026\"}").statusCode());
        HttpResponse<String> linked = call("POST", "/api/auth/google", null,
                "{\"googleSubject\":\"777\",\"email\":\"mai@gmail.com\",\"name\":\"Mai\",\"emailVerified\":true}",
                "X-Service-Key", SERVICE_KEY);
        assertEquals(200, linked.statusCode(), linked.body());
        assertEquals(UserRole.CUSTOMER.name(), role(linked));

        // Tài khoản nhân viên chỉ dùng mật khẩu: Google không được đăng nhập vào chúng, cũng không
        // được tạo tài khoản thứ hai.
        String admin = login(ADMIN_EMAIL, ADMIN_PASSWORD);
        createUser(admin, "thu.ngan@gmail.com", "staff");
        HttpResponse<String> staff = call("POST", "/api/auth/google", null,
                "{\"googleSubject\":\"999\",\"email\":\"thu.ngan@gmail.com\",\"name\":\"Thu Ngan\",\"emailVerified\":true}",
                "X-Service-Key", SERVICE_KEY);
        assertEquals(403, staff.statusCode());
        assertEquals("STAFF_PASSWORD_ONLY", code(staff));

        assertEquals(400, call("POST", "/api/auth/google", null,
                "{\"googleSubject\":\"5\",\"email\":\"x@gmail.com\",\"name\":\"X\",\"emailVerified\":false}",
                "X-Service-Key", SERVICE_KEY).statusCode());
        assertEquals(409, call("POST", "/api/auth/google", null,
                "{\"googleSubject\":\"other\",\"email\":\"lan@gmail.com\",\"name\":\"Lan\",\"emailVerified\":true}",
                "X-Service-Key", SERVICE_KEY).statusCode(), "one email cannot belong to two Google accounts");
    }

    @Test
    void usersChangeTheirOwnPassword() throws Exception {
        String admin = login(ADMIN_EMAIL, ADMIN_PASSWORD);
        assertEquals(401, call("POST", "/api/auth/password", admin,
                "{\"currentPassword\":\"Nope12345\",\"newPassword\":\"NewPass2026\"}").statusCode());
        assertEquals(400, call("POST", "/api/auth/password", admin,
                "{\"currentPassword\":\"" + ADMIN_PASSWORD + "\",\"newPassword\":\"weak\"}").statusCode());
        assertEquals(200, call("POST", "/api/auth/password", admin,
                "{\"currentPassword\":\"" + ADMIN_PASSWORD + "\",\"newPassword\":\"NewPass2026\"}").statusCode());
        login(ADMIN_EMAIL, "NewPass2026");
        assertEquals(401, call("POST", "/api/auth/password", null, "{\"newPassword\":\"NewPass2027\"}").statusCode());
    }
}
