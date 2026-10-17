package com.dalatcafe.security;

import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.dao.InMemoryUserDao;
import com.dalatcafe.model.UserAccount;
import com.dalatcafe.model.UserRole;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class SecurityTest {
    private static final byte[] SECRET = "unit-test-secret-long-enough-0123456789".getBytes(StandardCharsets.UTF_8);

    @Test
    void passwordHashesAreSaltedAndVerifiedInConstantForm() {
        PasswordHasher hasher = new PasswordHasher(10_000);
        String first = hasher.hash("Coffee2026");
        String second = hasher.hash("Coffee2026");
        assertNotEquals(first, second, "a random salt makes equal passwords hash differently");
        assertTrue(first.startsWith("pbkdf2_sha256$10000$"));
        assertTrue(hasher.verify("Coffee2026", first));
        assertFalse(hasher.verify("coffee2026", first));
        assertFalse(hasher.verify("Coffee2026", "plain-text"));
        assertFalse(hasher.verify("Coffee2026", null));
        assertFalse(hasher.verify("Coffee2026", "pbkdf2_sha256$abc$***$***"));
        // A hash made with another iteration count still verifies.
        assertTrue(new PasswordHasher(20_000).verify("Coffee2026", first));
        assertThrows(IllegalArgumentException.class, () -> new PasswordHasher(10));
        assertThrows(IllegalArgumentException.class, () -> hasher.hash(""));
    }

    @Test
    void tokensRoundTripAndExpire() {
        Instant start = Instant.parse("2026-10-17T08:00:00Z");
        UserAccount user = new UserAccount(7, "lan@gmail.com", "Lan Nguyễn", UserRole.MANAGER);
        String token = new TokenService(SECRET, Duration.ofHours(1), Clock.fixed(start, ZoneOffset.UTC)).issue(user);

        TokenService beforeExpiry = new TokenService(SECRET, Duration.ofHours(1), Clock.fixed(start.plusSeconds(3599), ZoneOffset.UTC));
        TokenService.Claims claims = beforeExpiry.verify(token).orElseThrow();
        assertEquals(7, claims.userId());
        assertEquals("MANAGER", claims.role());
        assertEquals("Lan Nguyễn", claims.name());

        TokenService afterExpiry = new TokenService(SECRET, Duration.ofHours(1), Clock.fixed(start.plusSeconds(3600), ZoneOffset.UTC));
        assertEquals(Optional.empty(), afterExpiry.verify(token));
        TokenService otherKey = new TokenService("another-secret-long-enough-0123456789".getBytes(StandardCharsets.UTF_8),
                Duration.ofHours(1), Clock.fixed(start, ZoneOffset.UTC));
        assertEquals(Optional.empty(), otherKey.verify(token));
        assertEquals(Optional.empty(), beforeExpiry.verify("a.b"));
        assertEquals(Optional.empty(), beforeExpiry.verify(null));
        assertThrows(IllegalArgumentException.class, () -> new TokenService(new byte[8], Duration.ofHours(1), Clock.systemUTC()));
    }

    @Test
    void throttleLocksAfterRepeatedFailuresAndUnlocksAfterTheWindow() {
        MutableClock clock = new MutableClock(Instant.parse("2026-10-17T08:00:00Z"));
        LoginThrottle throttle = new LoginThrottle(3, Duration.ofMinutes(15), clock);
        for (int i = 0; i < 3; i++) {
            assertFalse(throttle.isLocked("a@x.vn"));
            throttle.recordFailure("a@x.vn");
        }
        assertTrue(throttle.isLocked("a@x.vn"));
        assertFalse(throttle.isLocked("b@x.vn"), "other emails are not affected");
        clock.now = clock.now.plus(Duration.ofMinutes(16));
        assertFalse(throttle.isLocked("a@x.vn"));
        throttle.recordFailure("a@x.vn");
        throttle.recordSuccess("a@x.vn");
        assertFalse(throttle.isLocked("a@x.vn"));
    }

    @Test
    void bootstrapCreatesOneAdminOnlyWhenNoneExists() {
        InMemoryDatabase db = InMemoryDatabase.getInstance();
        db.reset();
        InMemoryUserDao users = new InMemoryUserDao(db);
        PasswordHasher hasher = new PasswordHasher(10_000);

        Optional<String> generated = AdminBootstrap.ensureAdmin(users, hasher, Map.of());
        assertTrue(generated.isPresent(), "without ADMIN_PASSWORD a random one is generated");
        UserAccount admin = users.findByEmail(AdminBootstrap.DEFAULT_EMAIL).orElseThrow();
        assertEquals(UserRole.ADMIN, admin.getRole());
        assertTrue(hasher.verify(generated.get(), admin.getPasswordHash()));

        assertEquals(Optional.empty(), AdminBootstrap.ensureAdmin(users, hasher, Map.of("ADMIN_EMAIL", "x@y.vn")));
        assertEquals(1, users.findAll().size(), "an existing admin means nothing is created");
    }

    @Test
    void settingsRefuseTheDevelopmentSecretInProduction() {
        assertThrows(IllegalStateException.class, () -> AuthSettings.fromEnvironment(Map.of("APP_ENV", "production")));
        AuthSettings dev = AuthSettings.fromEnvironment(Map.of());
        assertArrayEquals(AuthSettings.DEV_SECRET.getBytes(StandardCharsets.UTF_8), dev.jwtSecret());
        assertFalse(dev.allowRoleHeader());
        AuthSettings custom = AuthSettings.fromEnvironment(Map.of("AUTH_JWT_SECRET", "x".repeat(40),
                "AUTH_TOKEN_HOURS", "2", "AUTH_ALLOW_ROLE_HEADER", "true"));
        assertEquals(Duration.ofHours(2), custom.tokenTtl());
        assertTrue(custom.allowRoleHeader());
    }

    @Test
    void inMemoryUsersKeepEmailsUnique() {
        InMemoryDatabase db = InMemoryDatabase.getInstance();
        db.reset();
        InMemoryUserDao users = new InMemoryUserDao(db);
        UserAccount first = new UserAccount(null, "Mai@Cafe.vn", "Mai", UserRole.STAFF);
        assertTrue(users.save(first));
        assertEquals("mai@cafe.vn", users.findByEmail("MAI@cafe.vn").orElseThrow().getEmail());
        assertFalse(users.save(new UserAccount(null, "mai@cafe.vn", "Mai 2", UserRole.CUSTOMER)));
        assertTrue(users.save(new UserAccount(null, "other@cafe.vn", "Other", UserRole.CUSTOMER)));

        UserAccount loaded = users.findById(first.getId()).orElseThrow();
        loaded.setRole(UserRole.ADMIN); // a copy: the store changes only through save()
        assertEquals(UserRole.STAFF, users.findById(first.getId()).orElseThrow().getRole());
        assertTrue(UserRole.ADMIN.atLeast(UserRole.MANAGER));
        assertFalse(UserRole.CUSTOMER.atLeast(UserRole.STAFF));
    }

    private static final class MutableClock extends Clock {
        Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
