package com.dalatcafe.server;

import com.dalatcafe.dao.IUserDao;
import com.dalatcafe.model.UserAccount;
import com.dalatcafe.model.UserRole;
import com.dalatcafe.security.TokenService;
import com.sun.net.httpserver.Filter;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
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

    public SimpleAuthFilter(TokenService tokens, IUserDao users, boolean allowRoleHeader) {
        this.tokens = Objects.requireNonNull(tokens, "Token service must not be null");
        this.users = Objects.requireNonNull(users, "User DAO must not be null");
        this.allowRoleHeader = allowRoleHeader;
    }

    @Override
    public void doFilter(HttpExchange exchange, Chain chain) throws IOException {
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        Access access = required(method, exchange.getRequestURI().getPath());

        Identity identity = identify(exchange);
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

    private Identity identify(HttpExchange exchange) {
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
        if (allowRoleHeader) {
            UserRole role = parseRole(exchange.getRequestHeaders().getFirst("X-User-Role"));
            if (role != null) {
                return new Identity(new UserAccount(null, "header@local", "X-User-Role " + role, role), null);
            }
        }
        return Identity.ANONYMOUS;
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
        if (p.equals("/api/auth/register") || p.equals("/api/auth/login")) {
            return Access.PUBLIC;
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
