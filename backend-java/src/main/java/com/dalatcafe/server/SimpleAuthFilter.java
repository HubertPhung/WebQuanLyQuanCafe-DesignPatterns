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
 * Phân quyền theo vai trò (docs/API_SPEC.md mục 1.3).
 *
 * Người gọi được nhận diện bằng access token {@code Authorization: Bearer <token>} do
 * {@code /api/auth} cấp. Token chỉ cho biết người gọi là ai: vai trò được đọc lại từ tài khoản ở
 * mỗi request, nên đổi vai trò hay khóa tài khoản có hiệu lực ngay. Khi server chạy với
 * {@code allowRoleHeader} (lúc phát triển và trong test REST), header {@code X-User-Role} trần
 * cũng được chấp nhận; nếu có Bearer token thì token luôn được ưu tiên.
 *
 * Quy tắc: một số endpoint công khai; endpoint tài khoản cần người dùng đã đăng nhập bất kỳ; đổi
 * cài đặt quán và quản lý tài khoản cần ADMIN; thêm, sửa, xóa món và thống kê cần MANAGER+; mọi
 * endpoint còn lại cần STAFF+, nên endpoint mới không bao giờ vô tình bị công khai.
 *
 * Storefront đặt đơn online của khách theo kiểu server gọi server: không có Bearer token thì
 * {@code X-Service-Key} (AUTH_SERVICE_KEY) của frontend được coi là người gọi STAFF, chỉ đúng ở
 * {@code POST /api/checkout} và {@code POST /api/orders/sync}, không ở đâu khác.
 */
public class SimpleAuthFilter extends Filter {
    /**
     * Thuộc tính request giữ {@link UserAccount} đã xác thực (không có ở các lời gọi công khai).
     */
    public static final String USER_ATTRIBUTE = "auth.user";
    public static final String STOREFRONT_SERVICE_ATTRIBUTE = "auth.storefrontService";

    /** Quyền mà một request cần. */
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
        exchange = new RequestScopedExchange(exchange);
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        String path = exchange.getRequestURI().getPath();
        // HttpServer chọn context theo tiền tố đơn thuần, nên "/api/usersX" tới được handler
        // "/api/users" trong khi các quy tắc bên dưới chỉ đòi STAFF cho nó.
        if (!withinContext(path, exchange.getHttpContext().getPath())) {
            reject(exchange, 404, "NOT_FOUND", "Unknown resource: " + path);
            return;
        }
        Access access = required(method, path);

        Identity identity = identify(exchange, isServiceRoute(method, path)
                || isServiceLookup(method, path, exchange.getRequestURI().getRawQuery()));
        exchange.setAttribute(USER_ATTRIBUTE, identity.user());
        exchange.setAttribute(STOREFRONT_SERVICE_ATTRIBUTE, identity.user() != null
                && identity.user().getId() == null && "storefront@service.local".equals(identity.user().getEmail()));
        if (access == Access.PUBLIC) {
            // Token hết hạn không được làm hỏng thực đơn công khai hay việc đặt bàn: người gọi chỉ
            // được coi là ẩn danh.
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

    /** True khi đường dẫn chính là đường dẫn context hoặc một đường dẫn con của nó. */
    static boolean withinContext(String path, String context) {
        String base = context.endsWith("/") ? context : context + "/";
        return path.equals(context) || path.startsWith(base);
    }

    /**
     * Những lời gọi duy nhất service key của storefront được phép: đặt và đồng bộ đơn online, kiểm
     * tra mã cho một tài khoản, giữ và nhả lượt voucher của đơn COD.
     */
    static boolean isServiceRoute(String method, String path) {
        String p = path.replaceAll("/+$", "");
        return method.equals("POST") && (p.equals("/api/checkout") || p.equals("/api/orders/sync")
                || p.equals("/api/vouchers/validate") || p.equals("/api/vouchers/redeem") || p.equals("/api/vouchers/release"));
    }

    /**
     * Storefront được tra cứu một thành viên theo số điện thoại (trang tài khoản), không bao giờ
     * được liệt kê tất cả.
     */
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
        if (p.equals("/api/reservations/mine")) return Access.SIGNED_IN;
        if (p.equals("/api/tables/catalog") && method.equals("GET")
                || p.equals("/api/menu") && method.equals("GET")
                || p.equals("/api/reservations") && method.equals("POST")
                || p.equals("/api/vouchers/validate") && method.equals("POST")
                || p.equals("/api/vouchers/active") && method.equals("GET")) {
            return Access.PUBLIC;
        }
        // Thêm, sửa, xóa voucher và xem ai đã dùng mã; giữ/nhả lượt do handler tự đòi service key.
        if (p.equals("/api/vouchers") || p.matches("/api/vouchers/[0-9]+(/usages)?")) {
            return Access.MANAGER;
        }
        if (p.equals("/api/auth/register") || p.equals("/api/auth/login") || p.equals("/api/auth/google")) {
            return Access.PUBLIC; // endpoint Google tự kiểm tra service key của nó
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
        // Tạo, sửa và xóa món; bật/tắt bán một món vẫn thuộc quyền STAFF.
        if (p.equals("/api/menu") && method.equals("POST")
                || p.matches("/api/menu/[0-9]+") && (method.equals("PUT") || method.equals("PATCH") || method.equals("DELETE"))
                || p.startsWith("/api/analytics")) {
            return Access.MANAGER;
        }
        if (p.equals("/api/tables") && method.equals("POST")
                || p.matches("/api/tables/[0-9]+") && method.equals("DELETE")
                || p.matches("/api/tables/[0-9]+/details")) {
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
