package com.dalatcafe.security;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;
import java.util.Objects;
import java.util.logging.Logger;

/**
 * Cài đặt xác thực của server.
 *
 * @param jwtSecret       khóa HS256 dùng chung với frontend Next.js ({@code AUTH_JWT_SECRET})
 * @param serviceKey      key frontend gửi kèm khi báo một lượt đăng nhập Google đã xác minh
 *                        ({@code AUTH_SERVICE_KEY}); không có key thì đăng nhập Google bị từ chối
 * @param allowRoleHeader tin cả header {@code X-User-Role} trần (chỉ dùng khi phát triển và test)
 * @param tokenTtl        thời hạn của một access token
 */
public record AuthSettings(byte[] jwtSecret, String serviceKey, boolean allowRoleHeader, Duration tokenTtl) {
    private static final Logger LOGGER = Logger.getLogger(AuthSettings.class.getName());
    public static final Duration DEFAULT_TTL = Duration.ofHours(8);
    /**
     * Khóa bí mật chỉ dùng khi phát triển, giống mặc định của frontend, để chạy local không cần cấu
     * hình.
     */
    public static final String DEV_SECRET = "dalatcafe-dev-only-secret-change-me-0123456789";

    public AuthSettings {
        Objects.requireNonNull(jwtSecret, "Secret must not be null");
        Objects.requireNonNull(tokenTtl, "TTL must not be null");
        jwtSecret = jwtSecret.clone();
    }

    /** Khóa ngẫu nhiên và header vai trò kiểu cũ: cấu hình mà các test REST hiện có đang dùng. */
    public static AuthSettings withRoleHeader() {
        return new AuthSettings(randomBytes(32), base64(randomBytes(24)), true, DEFAULT_TTL);
    }

    /**
     * Đọc AUTH_JWT_SECRET, AUTH_SERVICE_KEY, AUTH_ALLOW_ROLE_HEADER và AUTH_TOKEN_HOURS. Với
     * APP_ENV=production, thiếu khóa bí mật hoặc khóa quá ngắn sẽ dừng server thay vì dùng khóa
     * phát triển.
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
        String serviceKey = env.get("AUTH_SERVICE_KEY");
        if (serviceKey == null || serviceKey.isBlank()) {
            LOGGER.warning("AUTH_SERVICE_KEY is not set: Google sign-in is disabled.");
            serviceKey = null;
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
        return new AuthSettings(secret.getBytes(StandardCharsets.UTF_8), serviceKey, header, ttl);
    }

    private static byte[] randomBytes(int length) {
        byte[] bytes = new byte[length];
        new SecureRandom().nextBytes(bytes);
        return bytes;
    }

    private static String base64(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
