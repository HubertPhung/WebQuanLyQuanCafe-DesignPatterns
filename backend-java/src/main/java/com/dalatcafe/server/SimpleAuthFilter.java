package com.dalatcafe.server;

import com.sun.net.httpserver.Filter;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;

/**
 * Header-based RBAC (docs/API_SPEC.md 1.4). The role comes from {@code X-User-Role}.
 * Public endpoints need no header; changing store settings needs ADMIN; creating menu items
 * and analytics need MANAGER or ADMIN;
 * every other endpoint needs STAFF, MANAGER or ADMIN.
 * This is a role gate for the course project, not authentication: roles are not verified.
 */
public class SimpleAuthFilter extends Filter {
    public enum Role { ADMIN, MANAGER, STAFF, CUSTOMER }

    private static final Set<Role> STAFF_UP = EnumSet.of(Role.STAFF, Role.MANAGER, Role.ADMIN);
    private static final Set<Role> MANAGER_UP = EnumSet.of(Role.MANAGER, Role.ADMIN);
    private static final Set<Role> ADMIN_ONLY = EnumSet.of(Role.ADMIN);

    @Override
    public void doFilter(HttpExchange exchange, Chain chain) throws IOException {
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        String path = exchange.getRequestURI().getPath();
        Set<Role> allowed = requiredRoles(method, path);

        if (allowed == null) {
            chain.doFilter(exchange);
            return;
        }
        String header = exchange.getRequestHeaders().getFirst("X-User-Role");
        Role role = parseRole(header);
        if (role == null) {
            ApiHandler.sendError(exchange, 401, "UNAUTHORIZED",
                    "Missing or invalid X-User-Role header");
            exchange.close();
            return;
        }
        if (!allowed.contains(role)) {
            ApiHandler.sendError(exchange, 403, "FORBIDDEN",
                    "Role " + role + " is not allowed to perform this action");
            exchange.close();
            return;
        }
        chain.doFilter(exchange);
    }

    /**
     * Roles allowed for the request, or null when the endpoint is public. Anything not listed
     * as public or manager-only needs STAFF+, so a new endpoint is never public by accident.
     */
    static Set<Role> requiredRoles(String method, String path) {
        String p = path.replaceAll("/+$", "");
        if (method.equals("OPTIONS")) {
            return null;
        }
        if (p.equals("/api/menu") && method.equals("GET")) {
            return null;
        }
        if (p.equals("/api/reservations") && method.equals("POST")) {
            return null;
        }
        if (p.equals("/api/vouchers/validate") && method.equals("POST")) {
            return null;
        }
        if (p.equals("/api/menu") && method.equals("POST")) {
            return MANAGER_UP;
        }
        if (p.startsWith("/api/analytics")) {
            return MANAGER_UP;
        }
        if (p.equals("/api/config") && !method.equals("GET")) {
            return ADMIN_ONLY;
        }
        return STAFF_UP;
    }

    static Role parseRole(String header) {
        if (header == null || header.isBlank()) {
            return null;
        }
        try {
            return Role.valueOf(header.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    @Override
    public String description() {
        return "Header-based role check";
    }
}
