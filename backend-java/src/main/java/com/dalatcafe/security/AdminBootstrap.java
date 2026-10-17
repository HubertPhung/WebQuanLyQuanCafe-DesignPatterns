package com.dalatcafe.security;

import com.dalatcafe.dao.IUserDao;
import com.dalatcafe.model.UserAccount;
import com.dalatcafe.model.UserRole;

import java.security.SecureRandom;
import java.util.Map;
import java.util.Optional;
import java.util.logging.Logger;

/**
 * Makes sure a fresh store has one administrator, so somebody can sign in and create the
 * staff accounts. Uses ADMIN_EMAIL / ADMIN_PASSWORD when set; otherwise creates
 * admin@dalatcafe.local with a random password that is printed once in the server log.
 * Does nothing while any active admin exists.
 */
public final class AdminBootstrap {
    private static final Logger LOGGER = Logger.getLogger(AdminBootstrap.class.getName());
    public static final String DEFAULT_EMAIL = "admin@dalatcafe.local";
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

    private AdminBootstrap() {
    }

    /** Returns the generated password when one was created, for the start-up log. */
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
