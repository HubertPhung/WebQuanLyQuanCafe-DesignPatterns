package com.dalatcafe.server;

import com.dalatcafe.dao.IUserDao;
import com.dalatcafe.model.UserAccount;
import com.dalatcafe.model.UserRole;
import com.dalatcafe.security.LoginThrottle;
import com.dalatcafe.security.PasswordHasher;
import com.dalatcafe.security.TokenService;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * /api/auth: sign-up, password sign-in, Google sign-in reported by the frontend, the current
 * account, and password change. Successful sign-ins answer with an HS256 access token.
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
    private final String serviceKey;
    /** Verified against when the email is unknown, so both failures cost the same time. */
    private final String dummyHash;

    public AuthHandler(IUserDao users, PasswordHasher hasher, TokenService tokens, LoginThrottle throttle, String serviceKey) {
        this.users = Objects.requireNonNull(users, "User DAO must not be null");
        this.hasher = Objects.requireNonNull(hasher, "Hasher must not be null");
        this.tokens = Objects.requireNonNull(tokens, "Token service must not be null");
        this.throttle = Objects.requireNonNull(throttle, "Throttle must not be null");
        this.serviceKey = serviceKey;
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
            case "google" -> {
                requireMethod(exchange, method, "POST");
                google(exchange);
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
        String password = presentedPassword(body, "password");
        if (password == null || password.isEmpty()) {
            throw ApiException.badRequest("Field 'password' is required");
        }
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

    /**
     * The frontend verified the Google ID token (signature, audience, issuer, nonce) and reports
     * the result here with the shared service key. Matches by Google id, then links an existing
     * customer account with the same verified email, otherwise creates a CUSTOMER.
     *
     * Google sign-in is for customers only: staff, manager and admin accounts keep signing in with
     * their password, so the lockout and the admin's control over those accounts always apply.
     */
    private void google(HttpExchange exchange) throws IOException {
        String presented = exchange.getRequestHeaders().getFirst("X-Service-Key");
        if (serviceKey == null || presented == null
                || !MessageDigest.isEqual(serviceKey.getBytes(StandardCharsets.UTF_8), presented.getBytes(StandardCharsets.UTF_8))) {
            throw new ApiException(401, "UNAUTHORIZED", "Google sign-in is only accepted from the frontend server");
        }
        Map<String, Object> body = readJsonBody(exchange);
        String subject = requireStr(body, "googleSubject");
        String email = email(body);
        if (!bool(body, "emailVerified", false)) {
            throw ApiException.badRequest("The Google email address is not verified");
        }
        UserAccount user = users.findByGoogleSubject(subject)
                .or(() -> users.findByEmail(email))
                .orElse(null);
        if (user == null) {
            user = new UserAccount(null, email, name(body), UserRole.CUSTOMER);
        } else if (user.getGoogleSubject() != null && !user.getGoogleSubject().equals(subject)) {
            throw new ApiException(409, "RESOURCE_CONFLICT", "This email is linked to a different Google account");
        }
        if (user.getRole() != UserRole.CUSTOMER) {
            throw new ApiException(403, "STAFF_PASSWORD_ONLY", "Staff accounts sign in with their email and password");
        }
        if (!user.isActive()) {
            throw new ApiException(403, "ACCOUNT_DISABLED", "This account has been disabled; contact an administrator");
        }
        boolean created = user.getId() == null;
        user.setGoogleSubject(subject);
        user.setLastLoginAt(Instant.now());
        if (!users.save(user)) {
            throw new ApiException(409, "EMAIL_TAKEN", "An account with this email already exists");
        }
        sendOk(exchange, created ? 201 : 200, session(user), created ? "Account created with Google" : "Signed in with Google");
    }

    private void changePassword(HttpExchange exchange) throws IOException {
        UserAccount user = currentUser(exchange);
        if (user.getId() == null) {
            throw ApiException.badRequest("Sign in with an account to change its password");
        }
        Map<String, Object> body = readJsonBody(exchange);
        String next = password(body, "newPassword");
        if (user.getPasswordHash() != null && !hasher.verify(presentedPassword(body, "currentPassword"), user.getPasswordHash())) {
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

    /** A password to check, exactly as typed: {@link #password} stores new ones untrimmed. */
    private static String presentedPassword(Map<String, Object> body, String key) {
        Object raw = body.get(key);
        if (raw != null && !(raw instanceof String)) {
            throw ApiException.badRequest("Field '" + key + "' must be a string");
        }
        return (String) raw;
    }

    static Map<String, Object> toJson(UserAccount user) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", user.getId());
        json.put("email", user.getEmail());
        json.put("name", user.getName());
        json.put("role", user.getRole().name());
        json.put("active", user.isActive());
        List<Object> providers = new ArrayList<>();
        if (user.getPasswordHash() != null) providers.add("password");
        if (user.getGoogleSubject() != null) providers.add("google");
        json.put("providers", providers);
        json.put("createdAt", user.getCreatedAt() == null ? null : user.getCreatedAt().toString());
        json.put("lastLoginAt", user.getLastLoginAt() == null ? null : user.getLastLoginAt().toString());
        return json;
    }
}
