package com.dalatcafe.security;

import com.dalatcafe.dao.IUserDao;
import com.dalatcafe.model.UserAccount;
import com.dalatcafe.model.UserRole;

import java.security.SecureRandom;
import java.util.Map;
import java.util.Optional;
import java.util.logging.Logger;

/**
 * Bảo đảm kho mới có một quản trị viên, để có người đăng nhập và tạo tài khoản nhân viên. Dùng
 * ADMIN_EMAIL / ADMIN_PASSWORD nếu được đặt; nếu không thì tạo admin@dalatcafe.local với mật khẩu
 * ngẫu nhiên in một lần trong log server. Không làm gì khi đã có quản trị viên đang hoạt động.
 */
public final class AdminBootstrap {
    private static final Logger LOGGER = Logger.getLogger(AdminBootstrap.class.getName());
    public static final String DEFAULT_EMAIL = "admin@dalatcafe.local";
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

    private AdminBootstrap() {
    }

    /** Trả về mật khẩu vừa sinh khi có tạo mới, để ghi vào log lúc khởi động. */
    public static Optional<String> ensureAdmin(IUserDao users, PasswordHasher hasher, Map<String, String> env) {
        boolean hasAdmin = users.findAll().stream().anyMatch(u -> u.isActive() && u.getRole() == UserRole.ADMIN);
        if (hasAdmin) {
            return Optional.empty();
        }
        String email = env.getOrDefault("ADMIN_EMAIL", DEFAULT_EMAIL);
        String password = env.get("ADMIN_PASSWORD");
        boolean generated = password == null || password.isBlank();
        if (generated) {
            password = randomPassword();
        }

        UserAccount admin = users.findByEmail(email).orElseGet(UserAccount::new);
        if (admin.getId() == null) {
            admin.setEmail(email);
            admin.setName("Quản trị viên");
        }
        admin.setRole(UserRole.ADMIN);
        admin.setActive(true);
        admin.setPasswordHash(hasher.hash(password));
        if (!users.save(admin)) {
            throw new IllegalStateException("Could not create the first administrator " + email);
        }
        if (generated) {
            LOGGER.warning("Created administrator " + email + " with a one-time password: " + password
                    + " (set ADMIN_EMAIL and ADMIN_PASSWORD to choose them)");
            return Optional.of(password);
        }
        LOGGER.info("Created administrator " + email + " from ADMIN_EMAIL / ADMIN_PASSWORD.");
        return Optional.empty();
    }

    private static String randomPassword() {
        SecureRandom random = new SecureRandom();
        StringBuilder out = new StringBuilder("Dl-");
        for (int i = 0; i < 16; i++) {
            out.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return out.append('9').toString();
    }
}
