package com.dalatcafe.server;

import com.dalatcafe.patterns.singleton.SystemConfigManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.LocalTime;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ConfigHandlerTest {
    private final SystemConfigManager config = SystemConfigManager.getInstance();

    @AfterEach
    void restoreConfig() {
        config.resetToDefaults();
    }

    @Test
    void settingsAreNeverReadHalfAppliedWhileAnAdminSavesThem() throws InterruptedException {
        AtomicBoolean stop = new AtomicBoolean();
        Thread admin = new Thread(() -> {
            for (int i = 0; !stop.get(); i++) {
                LocalTime opening = i % 2 == 0 ? LocalTime.of(13, 0) : LocalTime.of(7, 0);
                LocalTime closing = i % 2 == 0 ? LocalTime.of(22, 0) : LocalTime.of(12, 0);
                synchronized (config) { // the critical section ConfigHandler.update runs
                    config.setOpeningTime(opening);
                    config.setClosingTime(closing);
                }
            }
        });
        admin.start();
        try {
            long deadline = System.nanoTime() + Duration.ofSeconds(2).toNanos();
            while (System.nanoTime() < deadline) {
                Map<String, Object> json = ConfigHandler.toJson(config);
                LocalTime opening = LocalTime.parse((String) json.get("openingTime"));
                LocalTime closing = LocalTime.parse((String) json.get("closingTime"));
                assertTrue(opening.isBefore(closing), () -> "GET /api/config showed " + opening + " - " + closing);
            }
        } finally {
            stop.set(true);
            admin.join();
        }
    }
}
