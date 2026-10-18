package com.dalatcafe.server;

import com.dalatcafe.dao.IUserDao;
import com.dalatcafe.model.UserAccount;
import com.dalatcafe.model.UserRole;
import com.dalatcafe.security.TokenService;
import com.sun.net.httpserver.Filter;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

/**
 * Role-based access control (docs/API_SPEC.md 1.3).
 *
 * The caller is identified by an {@code Authorization: Bearer <token>} access token issued by
 * {@code /api/auth}. The token only says who the caller is: the role is re-read from the account
 * on every request, so a role change or a disabled account takes effect at once. When the server
 * runs with {@code allowRoleHeader} (development and the REST tests) a bare {@code X-User-Role}
 * header is accepted as well; a Bearer token, when present, always wins.
 *
 * Rules: a few endpoints are public; account endpoints need any signed-in user; changing store
 * settings and managing accounts need ADMIN; creating menu items and analytics need MANAGER+;
 * every other endpoint needs STAFF+, so a new endpoint is never public by accident.
 *
 * The storefront places guests' online orders server to server: without a Bearer token, the
 * frontend's {@code X-Service-Key} (AUTH_SERVICE_KEY) counts as a STAFF caller on exactly
 * {@code POST /api/checkout} and {@code POST /api/orders/sync}, and nowhere else.
 */
public class SimpleAuthFilter extends Filter {
    /** Request attribute holding the authenticated {@link UserAccount} (absent on public calls). */
    public static final String USER_ATTRIBUTE = "auth.user";

    /** What a request needs. */
    enum Access {
        PUBLIC(null), SIGNED_IN(UserRole.CUSTOMER), STAFF(UserRole.STAFF), MANAGER(UserRole.MANAGER), ADMIN(UserRole.ADMIN);

        final UserRole minimum;

        Access(UserRole minimum) {
            this.minimum = minimum;
        }
    }

    private final TokenService tokens;
    private final IUserDao users;
    private final boolean allowRoleHeader;
    private final String serviceKey;

    public SimpleAuthFilter(TokenService tokens, IUserDao users, boolean allowRoleHeader) {
        this(tokens, users, allowRoleHeader, null);
    }

    public SimpleAuthFilter(TokenService tokens, IUserDao users, boolean allowRoleHeader, String serviceKey) {
        this.tokens = Objects.requireNonNull(tokens, "Token service must not be null");
        this.users = Objects.requireNonNull(users, "User DAO must not be null");
        this.allowRoleHeader = allowRoleHeader;
        this.serviceKey = serviceKey == null || serviceKey.isBlank() ? null : serviceKey;
    }

    @Override
    public void doFilter(HttpExchange exchange, Chain chain) throws IOException {
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        String path = exchange.getRequestURI().getPath();
        // HttpServer picks a context by plain prefix, so "/api/usersX" reaches the "/api/users"
        // handler while the rules below would only ask STAFF for it.
        if (!withinContext(path, exchange.getHttpContext().getPath())) {
            reject(exchange, 404, "NOT_FOUND", "Unknown resource: " + path);
            return;
        }
        Access access = required(method, path);

        Identity identity = identify(exchange, isServiceRoute(method, path)
                || isServiceLookup(method, path, exchange.getRequestURI().getRawQuery()));
        if (identity.user() != null) {
            exchange.setAttribute(USER_ATTRIBUTE, identity.user());
        }
        if (access == Access.PUBLIC) {
            // A stale token must not break the public menu or a booking: the caller is just anonymous.
            chain.doFilter(exchange);
            return;
        }
        if (identity.error() != null) {
            reject(exchange, 401, "UNAUTHORIZED", identity.error());
            return;
        }
        if (identity.user() == null) {
            reject(exchange, 401, "UNAUTHORIZED", "Sign in first: send Authorization: Bearer <token>");
            return;
        }
        UserRole role = identity.user().getRole();
        if (!role.atLeast(access.minimum)) {
            reject(exchange, 403, "FORBIDDEN", "Role " + role + " is not allowed to perform this action");
            return;
        }
        chain.doFilter(exchange);
    }

    private record Identity(UserAccount user, String error) {
        static final Identity ANONYMOUS = new Identity(null, null);
    }

    private Identity identify(HttpExchange exchange, boolean serviceRoute) {
        String authorization = exchange.getRequestHeaders().getFirst("Authorization");
        if (authorization != null && !authorization.isBlank()) {
            if (!authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
                return new Identity(null, "Unsupported Authorization scheme; use Bearer");
            }
            Optional<TokenService.Claims> claims = tokens.verify(authorization.substring(7).trim());
            if (claims.isEmpty()) {
                return new Identity(null, "Invalid or expired access token");
            }
            Optional<UserAccount> account = users.findById(claims.get().userId());
            if (account.isEmpty() || !account.get().isActive()) {
                return new Identity(null, "This account no longer exists or has been disabled");
            }
            return new Identity(account.get(), null);
        }
        if (serviceRoute && presentsServiceKey(exchange)) {
            return new Identity(new UserAccount(null, "storefront@service.local", "Storefront service", UserRole.STAFF), null);
        }
        if (allowRoleHeader) {
            UserRole role = parseRole(exchange.getRequestHeaders().getFirst("X-User-Role"));
            if (role != null) {
                return new Identity(new UserAccount(null, "header@local", "X-User-Role " + role, role), null);
            }
        }
        return Identity.ANONYMOUS;
    }

    private boolean presentsServiceKey(HttpExchange exchange) {
        String presented = exchange.getRequestHeaders().getFirst("X-Service-Key");
        return serviceKey != null && presented != null
                && MessageDigest.isEqual(serviceKey.getBytes(StandardCharsets.UTF_8), presented.getBytes(StandardCharsets.UTF_8));
    }

    /** True when the path is the context path itself or a sub-path of it. */
    static boolean withinContext(String path, String context) {
        String base = context.endsWith("/") ? context : context + "/";
        return path.equals(context) || path.startsWith(base);
    }

    /** The only calls the storefront service key may make: placing and syncing online orders. */
    static boolean isServiceRoute(String method, String path) {
        String p = path.replaceAll("/+$", "");
        return method.equals("POST") && (p.equals("/api/checkout") || p.equals("/api/orders/sync"));
    }

    /** The storefront may look up one member by phone (the account page), never list them all. */
    static boolean isServiceLookup(String method, String path, String rawQuery) {
        if (!method.equals("GET") || !path.replaceAll("/+$", "").equals("/api/customers") || rawQuery == null) {
            return false;
        }
        for (String pair : rawQuery.split("&")) {
            if (pair.startsWith("phone=") && pair.length() > "phone=".length()) {
                return true;
            }
        }
        return false;
    }

    private static void reject(HttpExchange exchange, int status, String code, String message) throws IOException {
        ApiHandler.sendError(exchange, status, code, message);
        exchange.close();
    }

    static Access required(String method, String path) {
        String p = path.replaceAll("/+$", "");
        if (method.equals("OPTIONS")) {
            return Access.PUBLIC;
        }
        if (p.equals("/api/menu") && method.equals("GET")
                || p.equals("/api/reservations") && method.equals("POST")
                || p.equals("/api/vouchers/validate") && method.equals("POST")) {
            return Access.PUBLIC;
        }
        if (p.equals("/api/auth/register") || p.equals("/api/auth/login") || p.equals("/api/auth/google")) {
            return Access.PUBLIC; // the Google endpoint checks its own service key
        }
        if (p.startsWith("/api/auth/")) {
            return Access.SIGNED_IN;
        }
        if (p.equals("/api/users") || p.startsWith("/api/users/")) {
            return Access.ADMIN;
        }
        if (p.equals("/api/config") && !method.equals("GET")) {
            return Access.ADMIN;
        }
        if (p.equals("/api/menu") && method.equals("POST") || p.startsWith("/api/analytics")) {
            return Access.MANAGER;
        }
        return Access.STAFF;
    }

    static UserRole parseRole(String header) {
        if (header == null || header.isBlank()) {
            return null;
        }
        try {
            return UserRole.valueOf(header.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    @Override
    public String description() {
        return "Bearer token role check";
    }
}
