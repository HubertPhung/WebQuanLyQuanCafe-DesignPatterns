package com.dalatcafe.security;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Băm mật khẩu bằng PBKDF2-HMAC-SHA256 (Java SE thuần). Lưu dạng {@code
 * pbkdf2_sha256$<iterations>$<salt b64>$<hash b64>} với salt ngẫu nhiên 16 byte, nên sau này tăng
 * số vòng lặp không làm hỏng các hash cũ.
 */
public final class PasswordHasher {
    /** Mức khuyến nghị OWASP 2023 cho PBKDF2-HMAC-SHA256. */
    public static final int DEFAULT_ITERATIONS = 600_000;
    private static final String PREFIX = "pbkdf2_sha256";
    private static final int SALT_BYTES = 16;
    private static final int HASH_BITS = 256;

    private final int iterations;
    private final SecureRandom random = new SecureRandom();

    public PasswordHasher() {
        this(DEFAULT_ITERATIONS);
    }

    /** Test truyền số vòng lặp thấp để chạy nhanh; production dùng giá trị mặc định. */
    public PasswordHasher(int iterations) {
        if (iterations < 1_000) {
            throw new IllegalArgumentException("Iterations must be at least 1000");
        }
        this.iterations = iterations;
    }

    public String hash(String password) {
        if (password == null || password.isEmpty()) {
            throw new IllegalArgumentException("Password must not be empty");
        }
        byte[] salt = new byte[SALT_BYTES];
        random.nextBytes(salt);
        byte[] hash = derive(password, salt, iterations);
        Base64.Encoder b64 = Base64.getEncoder();
        return PREFIX + "$" + iterations + "$" + b64.encodeToString(salt) + "$" + b64.encodeToString(hash);
    }

    /** So sánh trong thời gian cố định; hash sai định dạng hoặc bị thiếu thì không bao giờ khớp. */
    public boolean verify(String password, String stored) {
        if (password == null || stored == null) {
            return false;
        }
        String[] parts = stored.split("\\$");
        if (parts.length != 4 || !PREFIX.equals(parts[0])) {
            return false;
        }
        try {
            int rounds = Integer.parseInt(parts[1]);
            byte[] salt = Base64.getDecoder().decode(parts[2]);
            byte[] expected = Base64.getDecoder().decode(parts[3]);
            return MessageDigest.isEqual(expected, derive(password, salt, rounds));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static byte[] derive(String password, byte[] salt, int rounds) {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, rounds, HASH_BITS);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("PBKDF2WithHmacSHA256 is not available", e);
        } finally {
            spec.clearPassword();
        }
    }
}
