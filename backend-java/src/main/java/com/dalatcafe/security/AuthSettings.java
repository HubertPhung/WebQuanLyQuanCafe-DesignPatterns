package com.dalatcafe.security;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Map;
import java.util.Objects;
import java.util.logging.Logger;

/**
 * Authentication settings of the server.
 *
 * @param jwtSecret       HS256 key shared with the Next.js frontend ({@code AUTH_JWT_SECRET})
 * @param allowRoleHeader also trust a bare {@code X-User-Role} header (development and tests only)
 * @param tokenTtl        lifetime of an access token
 */
public record AuthSettings(byte[] jwtSecret, boolean allowRoleHeader, Duration tokenTtl) {
    private static final Logger LOGGER = Logger.getLogger(AuthSettings.class.getName());
    public static final Duration DEFAULT_TTL = Duration.ofHours(8);
    /** Development-only secret, identical to the frontend's default, so a local run needs no setup. */
    public static final String DEV_SECRET = "dalatcafe-dev-only-secret-change-me-0123456789";

    public AuthSettings {
        Objects.requireNonNull(jwtSecret, "Secret must not be null");
        Objects.requireNonNull(tokenTtl, "TTL must not be null");
        jwtSecret = jwtSecret.clone();
    }

    /** Random keys and the legacy role header: what the existing REST tests run with. */
    public static AuthSettings withRoleHeader() {
        return new AuthSettings(randomBytes(32), true, DEFAULT_TTL);
    }

    /**
     * Reads AUTH_JWT_SECRET, AUTH_ALLOW_ROLE_HEADER and AUTH_TOKEN_HOURS.
     * With APP_ENV=production a missing or short secret stops the server instead of falling
     * back to the development secret.
     */
    public static AuthSettings fromEnvironment(Map<String, String> env) {
        String secret = env.get("AUTH_JWT_SECRET");
        boolean production = "production".equalsIgnoreCase(env.getOrDefault("APP_ENV", ""));
        if (secret == null || secret.length() < 32) {
            if (production) {
                throw new IllegalStateException("AUTH_JWT_SECRET must be set (at least 32 characters) when APP_ENV=production");
            }
            LOGGER.warning("AUTH_JWT_SECRET is not set: using the development secret. Never do this in production.");
            secret = DEV_SECRET;
        }
        boolean header = "true".equalsIgnoreCase(env.get("AUTH_ALLOW_ROLE_HEADER"));
        if (header) {
            LOGGER.warning("AUTH_ALLOW_ROLE_HEADER=true: an unauthenticated X-User-Role header is trusted.");
        }
        Duration ttl = DEFAULT_TTL;
        String hours = env.get("AUTH_TOKEN_HOURS");
        if (hours != null && hours.matches("\\d{1,3}") && Integer.parseInt(hours) > 0) {
            ttl = Duration.ofHours(Integer.parseInt(hours));
        }
        return new AuthSettings(secret.getBytes(StandardCharsets.UTF_8), header, ttl);
    }

    private static byte[] randomBytes(int length) {
        byte[] bytes = new byte[length];
        new SecureRandom().nextBytes(bytes);
        return bytes;
    }
}
