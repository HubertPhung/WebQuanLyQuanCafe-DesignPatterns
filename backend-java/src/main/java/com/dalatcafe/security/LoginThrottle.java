package com.dalatcafe.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Slows down password guessing: after {@code maxFailures} wrong passwords for one email within
 * {@code window}, that email is locked until the window has passed. A successful sign-in clears
 * the count. Kept in memory, per server process.
 */
public final class LoginThrottle {
    public static final int DEFAULT_MAX_FAILURES = 5;
    public static final Duration DEFAULT_WINDOW = Duration.ofMinutes(15);

    private final int maxFailures;
    private final Duration window;
    private final Clock clock;
    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();

    private record Attempts(int failures, Instant firstFailure) {
    }

    public LoginThrottle(int maxFailures, Duration window, Clock clock) {
        if (maxFailures < 1) {
            throw new IllegalArgumentException("maxFailures must be at least 1");
        }
        this.maxFailures = maxFailures;
        this.window = Objects.requireNonNull(window, "Window must not be null");
        this.clock = Objects.requireNonNull(clock, "Clock must not be null");
    }

    public boolean isLocked(String key) {
        Attempts current = attempts.get(key);
        if (current == null) {
            return false;
        }
        if (expired(current)) {
            attempts.remove(key, current);
            return false;
        }
        return current.failures() >= maxFailures;
    }

    public void recordFailure(String key) {
        attempts.compute(key, (k, current) -> current == null || expired(current)
                ? new Attempts(1, clock.instant())
                : new Attempts(current.failures() + 1, current.firstFailure()));
    }

    public void recordSuccess(String key) {
        attempts.remove(key);
    }

    private boolean expired(Attempts current) {
        return current.firstFailure().plus(window).isBefore(clock.instant());
    }
}
