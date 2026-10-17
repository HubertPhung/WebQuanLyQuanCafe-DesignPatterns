package com.dalatcafe.security;

import com.dalatcafe.model.UserAccount;
import com.dalatcafe.util.Json;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Issues and verifies JWT access tokens signed with HS256 (pure Java SE). The Next.js frontend
 * verifies the same tokens with the shared secret. Verification accepts only
 * {@code alg: HS256}, so a forged {@code alg: none} token is rejected.
 */
public final class TokenService {
    private static final String HEADER = base64Url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));

    private final byte[] secret;
    private final Duration ttl;
    private final Clock clock;

    /** Verified token contents. The role in the token is informational; callers re-read the account. */
    public record Claims(int userId, String email, String name, String role, long expiresAt) {
    }

    public TokenService(byte[] secret, Duration ttl, Clock clock) {
        Objects.requireNonNull(secret, "Secret must not be null");
        if (secret.length < 32) {
            throw new IllegalArgumentException("The token secret must be at least 32 bytes");
        }
        this.secret = secret.clone();
        this.ttl = Objects.requireNonNull(ttl, "TTL must not be null");
        this.clock = Objects.requireNonNull(clock, "Clock must not be null");
    }

    public Duration getTtl() {
        return ttl;
    }

    public String issue(UserAccount user) {
        long now = clock.instant().getEpochSecond();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sub", String.valueOf(user.getId()));
        payload.put("email", user.getEmail());
        payload.put("name", user.getName());
        payload.put("role", user.getRole().name());
        payload.put("iat", now);
        payload.put("exp", now + ttl.toSeconds());
        String body = base64Url(Json.stringify(payload).getBytes(StandardCharsets.UTF_8));
        String signingInput = HEADER + "." + body;
        return signingInput + "." + base64Url(sign(signingInput));
    }

    public Optional<Claims> verify(String token) {
        if (token == null) {
            return Optional.empty();
        }
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            return Optional.empty();
        }
        try {
            Map<String, Object> header = Json.parseObject(new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8));
            if (!"HS256".equals(header.get("alg"))) {
                return Optional.empty();
            }
            byte[] expected = sign(parts[0] + "." + parts[1]);
            if (!MessageDigest.isEqual(expected, Base64.getUrlDecoder().decode(parts[2]))) {
                return Optional.empty();
            }
            Map<String, Object> payload = Json.parseObject(new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8));
            if (!(payload.get("exp") instanceof Number exp) || exp.longValue() <= clock.instant().getEpochSecond()) {
                return Optional.empty();
            }
            int userId = Integer.parseInt(String.valueOf(payload.get("sub")));
            return Optional.of(new Claims(userId, (String) payload.get("email"), (String) payload.get("name"),
                    (String) payload.get("role"), exp.longValue()));
        } catch (RuntimeException e) {
            // Bad base64, bad JSON or a non-numeric subject: not a token we issued.
            return Optional.empty();
        }
    }

    private byte[] sign(String input) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return mac.doFinal(input.getBytes(StandardCharsets.US_ASCII));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 is not available", e);
        }
    }

    private static String base64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
