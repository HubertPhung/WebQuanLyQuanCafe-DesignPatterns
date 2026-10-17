package com.dalatcafe.server;

import com.dalatcafe.dao.DaoFactory;
import com.dalatcafe.dao.InMemoryDatabase;
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
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Sign-up, sign-in and RBAC with real access tokens: the server runs without
 * the X-User-Role shortcut, exactly like production.
 */
class AuthTest {
    private static final String SECRET = "test-secret-that-is-long-enough-0123456789";
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
        AuthSettings auth = new AuthSettings(SECRET.getBytes(StandardCharsets.UTF_8), false, Duration.ofHours(1));
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
        // A stale token does not break public endpoints.
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
    void lastAdminCannotBeDemotedOrDisabled() throws Exception {
        String admin = login(ADMIN_EMAIL, ADMIN_PASSWORD);
        int adminId = ((Number) data(call("GET", "/api/auth/me", admin, null)).get("id")).intValue();
        assertEquals(409, call("PATCH", "/api/users/" + adminId, admin, "{\"role\":\"staff\"}").statusCode());
        assertEquals(409, call("PATCH", "/api/users/" + adminId, admin, "{\"active\":false}").statusCode());

        int second = createUser(admin, "owner2@dalatcafe.vn", "admin");
        String other = login("owner2@dalatcafe.vn", "Staff1234");
        // Still blocked for oneself, allowed for another admin while one admin remains.
        assertEquals(409, call("PATCH", "/api/users/" + adminId, admin, "{\"role\":\"manager\"}").statusCode());
        assertEquals(200, call("PATCH", "/api/users/" + adminId, other, "{\"role\":\"manager\"}").statusCode());
        assertEquals(409, call("PATCH", "/api/users/" + second, other, "{\"active\":false}").statusCode());
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
