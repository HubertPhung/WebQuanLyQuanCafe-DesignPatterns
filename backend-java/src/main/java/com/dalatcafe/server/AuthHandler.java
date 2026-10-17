package com.dalatcafe.server;

import com.dalatcafe.dao.IUserDao;
import com.dalatcafe.model.UserAccount;
import com.dalatcafe.model.UserRole;
import com.dalatcafe.security.LoginThrottle;
import com.dalatcafe.security.PasswordHasher;
import com.dalatcafe.security.TokenService;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * /api/auth: sign-up, password sign-in, the current account and password change. Successful
 * sign-ins answer with an HS256 access token.
 *
 * Sign-up always creates a CUSTOMER; staff roles are given by an admin through /api/users.
 * Wrong email and wrong password get the same answer (and take about the same time), and a
 * {@link LoginThrottle} locks an email after repeated failures.
 */
public class AuthHandler extends ApiHandler {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    static final int MIN_PASSWORD = 8;
    static final int MAX_PASSWORD = 128;

    private final IUserDao users;
    private final PasswordHasher hasher;
    private final TokenService tokens;
    private final LoginThrottle throttle;
    /** Verified against when the email is unknown, so both failures cost the same time. */
    private final String dummyHash;

    public AuthHandler(IUserDao users, PasswordHasher hasher, TokenService tokens, LoginThrottle throttle) {
        this.users = Objects.requireNonNull(users, "User DAO must not be null");
        this.hasher = Objects.requireNonNull(hasher, "Hasher must not be null");
        this.tokens = Objects.requireNonNull(tokens, "Token service must not be null");
        this.throttle = Objects.requireNonNull(throttle, "Throttle must not be null");
        this.dummyHash = hasher.hash("not-a-real-password-0");
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        List<String> parts = segments(exchange);
        String action = parts.size() == 3 ? parts.get(2) : "";
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        switch (action) {
            case "register" -> {
                requireMethod(exchange, method, "POST");
                register(exchange);
            }
            case "login" -> {
                requireMethod(exchange, method, "POST");
                login(exchange);
            }
            case "me" -> {
                requireMethod(exchange, method, "GET");
                sendOk(exchange, 200, toJson(currentUser(exchange)), null);
            }
            case "password" -> {
                requireMethod(exchange, method, "POST");
                changePassword(exchange);
            }
            default -> throw ApiException.notFound("Unknown auth resource");
        }
    }

    private static void requireMethod(HttpExchange exchange, String method, String expected) {
        if (!method.equals(expected)) {
            throw methodNotAllowed(exchange);
        }
    }

    private void register(HttpExchange exchange) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        UserAccount user = new UserAccount(null, email(body), name(body), UserRole.CUSTOMER);
        user.setPasswordHash(hasher.hash(password(body, "password")));
        user.setLastLoginAt(Instant.now());
        if (!users.save(user)) {
            throw new ApiException(409, "EMAIL_TAKEN", "An account with this email already exists");
        }
        sendOk(exchange, 201, session(user), "Account created");
    }

    private void login(HttpExchange exchange) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        String email = UserAccount.normalizeEmail(requireStr(body, "email"));
        String password = requireStr(body, "password");
        if (throttle.isLocked(email)) {
            throw new ApiException(429, "TOO_MANY_ATTEMPTS", "Too many failed sign-ins for this email; try again later");
        }
        UserAccount user = users.findByEmail(email).orElse(null);
        String stored = user == null || user.getPasswordHash() == null ? dummyHash : user.getPasswordHash();
        boolean matches = hasher.verify(password, stored) && user != null && user.getPasswordHash() != null;
        if (!matches) {
            throttle.recordFailure(email);
            throw new ApiException(401, "INVALID_CREDENTIALS", "Wrong email or password");
        }
        throttle.recordSuccess(email);
        if (!user.isActive()) {
            throw new ApiException(403, "ACCOUNT_DISABLED", "This account has been disabled; contact an administrator");
        }
        user.setLastLoginAt(Instant.now());
        users.save(user);
        sendOk(exchange, 200, session(user), "Signed in");
    }

    private void changePassword(HttpExchange exchange) throws IOException {
        UserAccount user = currentUser(exchange);
        if (user.getId() == null) {
            throw ApiException.badRequest("Sign in with an account to change its password");
        }
        Map<String, Object> body = readJsonBody(exchange);
        String next = password(body, "newPassword");
        if (!hasher.verify(str(body, "currentPassword"), user.getPasswordHash())) {
            throw new ApiException(401, "INVALID_CREDENTIALS", "The current password is wrong");
        }
        user.setPasswordHash(hasher.hash(next));
        if (!users.save(user)) {
            throw new ApiException(500, "INTERNAL_SERVER_ERROR", "Could not save the new password");
        }
        sendOk(exchange, 200, toJson(user), "Password changed");
    }

    static UserAccount currentUser(HttpExchange exchange) {
        Object user = exchange.getAttribute(SimpleAuthFilter.USER_ATTRIBUTE);
        if (!(user instanceof UserAccount account)) {
            throw new ApiException(401, "UNAUTHORIZED", "Sign in first");
        }
        return account;
    }

    private Map<String, Object> session(UserAccount user) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("token", tokens.issue(user));
        data.put("expiresIn", tokens.getTtl().toSeconds());
        data.put("user", toJson(user));
        return data;
    }

    static String email(Map<String, Object> body) {
        String email = UserAccount.normalizeEmail(requireStr(body, "email"));
        if (email.length() > 254 || !EMAIL.matcher(email).matches()) {
            throw ApiException.badRequest("Enter a valid email address");
        }
        return email;
    }

    static String name(Map<String, Object> body) {
        String name = requireStr(body, "name").trim();
        if (name.length() > 80) {
            throw ApiException.badRequest("Name must be at most 80 characters");
        }
        return name;
    }

    /** 8 to 128 characters with at least one letter and one digit. */
    static String password(Map<String, Object> body, String key) {
        Object raw = body.get(key);
        String password = raw instanceof String s ? s : null;
        if (password == null || password.length() < MIN_PASSWORD || password.length() > MAX_PASSWORD
                || password.chars().noneMatch(Character::isLetter) || password.chars().noneMatch(Character::isDigit)) {
            throw ApiException.badRequest("Password must be " + MIN_PASSWORD + " to " + MAX_PASSWORD
                    + " characters with at least one letter and one digit");
        }
        return password;
    }

    static Map<String, Object> toJson(UserAccount user) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", user.getId());
        json.put("email", user.getEmail());
        json.put("name", user.getName());
        json.put("role", user.getRole().name());
        json.put("active", user.isActive());
        json.put("createdAt", user.getCreatedAt() == null ? null : user.getCreatedAt().toString());
        json.put("lastLoginAt", user.getLastLoginAt() == null ? null : user.getLastLoginAt().toString());
        return json;
    }
}
