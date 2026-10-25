package com.dalatcafe.server;

import com.dalatcafe.dao.IUserDao;
import com.dalatcafe.model.UserAccount;
import com.dalatcafe.model.UserRole;
import com.dalatcafe.security.PasswordHasher;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * /api/users (ADMIN): liệt kê tài khoản, tạo tài khoản nhân viên kèm vai trò, đổi vai trò, đổi tên,
 * đặt lại mật khẩu hoặc khóa tài khoản. Quản trị viên đang hoạt động cuối cùng không thể bị hạ
 * quyền hay khóa, và quản trị viên không thể tự khóa chính mình.
 */
public class UserHandler extends ApiHandler {
    private final IUserDao users;
    private final PasswordHasher hasher;

    public UserHandler(IUserDao users, PasswordHasher hasher) {
        this.users = Objects.requireNonNull(users, "User DAO must not be null");
        this.hasher = Objects.requireNonNull(hasher, "Hasher must not be null");
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        List<String> parts = segments(exchange);
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        if (parts.size() == 2) {
            switch (method) {
                case "GET" -> {
                    List<Object> data = new ArrayList<>();
                    users.findAll().forEach(user -> data.add(AuthHandler.toJson(user)));
                    sendOk(exchange, 200, data, null);
                }
                case "POST" -> create(exchange);
                default -> throw methodNotAllowed(exchange);
            }
            return;
        }
        if (parts.size() == 3) {
            if (!method.equals("PATCH") && !method.equals("PUT")) {
                throw methodNotAllowed(exchange);
            }
            update(exchange, parseId(parts.get(2)));
            return;
        }
        throw ApiException.notFound("Unknown user resource");
    }

    private void create(HttpExchange exchange) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        UserAccount user = new UserAccount(null, AuthHandler.email(body), AuthHandler.name(body), role(requireStr(body, "role")));
        user.setPasswordHash(hasher.hash(AuthHandler.password(body, "password")));
        if (!users.save(user)) {
            throw new ApiException(409, "EMAIL_TAKEN", "An account with this email already exists");
        }
        sendOk(exchange, 201, AuthHandler.toJson(user), "Account created");
    }

    // Đồng bộ hóa để hai lượt hạ quyền đồng thời không cùng vượt qua bước kiểm tra quản trị viên
    // cuối cùng.
    private synchronized void update(HttpExchange exchange, int id) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        UserAccount actor = AuthHandler.currentUser(exchange);
        UserAccount target = users.findById(id).orElseThrow(() -> ApiException.notFound("User not found: " + id));

        UserRole role = body.get("role") == null ? target.getRole() : role(requireStr(body, "role"));
        boolean active = bool(body, "active", target.isActive());
        boolean losesAdmin = target.getRole() == UserRole.ADMIN && target.isActive() && (role != UserRole.ADMIN || !active);
        if (losesAdmin && Objects.equals(actor.getId(), target.getId())) {
            throw new ApiException(409, "RESOURCE_CONFLICT", "You cannot remove your own admin access");
        }
        if (losesAdmin && activeAdmins() <= 1) {
            throw new ApiException(409, "RESOURCE_CONFLICT", "The last active administrator cannot be demoted or disabled");
        }

        target.setRole(role);
        target.setActive(active);
        if (body.get("name") != null) {
            target.setName(AuthHandler.name(body));
        }
        if (body.get("password") != null) {
            target.setPasswordHash(hasher.hash(AuthHandler.password(body, "password")));
        }
        if (!users.save(target)) {
            throw new ApiException(500, "INTERNAL_SERVER_ERROR", "Could not save user " + id);
        }
        sendOk(exchange, 200, AuthHandler.toJson(target), "User updated");
    }

    private long activeAdmins() {
        return users.findAll().stream().filter(u -> u.isActive() && u.getRole() == UserRole.ADMIN).count();
    }

    private static UserRole role(String raw) {
        try {
            return UserRole.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("role must be one of: customer, staff, manager, admin");
        }
    }
}
