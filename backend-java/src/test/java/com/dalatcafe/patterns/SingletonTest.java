package com.dalatcafe.patterns;

import com.dalatcafe.patterns.singleton.SystemConfigManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.*;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.TimeZone;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

@DisplayName("Đà Lạt Cafe - Singleton Pattern (SystemConfigManager) Unit Tests")
class SingletonTest {

    private SystemConfigManager config;

    @BeforeEach
    void setUp() {
        config = SystemConfigManager.getInstance();
        config.resetToDefaults();
    }

    @Nested
    @DisplayName("Singleton Instance Integrity Tests")
    class SingletonIntegrityTests {

        @Test
        @DisplayName("getInstance should consistently return the exact same object reference")
        void testSingleInstanceIdentity() {
            SystemConfigManager first = SystemConfigManager.getInstance();
            SystemConfigManager second = SystemConfigManager.getInstance();
            SystemConfigManager third = SystemConfigManager.getInstance();

            assertSame(first, second, "Both instances must reference the exact same memory object");
            assertSame(second, third, "All instances must reference the exact same memory object");
        }

        @Test
        @DisplayName("getInstance must be 100% thread-safe under high concurrent access")
        void testMultiThreadedConcurrency() throws InterruptedException {
            int threadCount = 50;
            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch startLatch = new CountDownLatch(1);
            CountDownLatch doneLatch = new CountDownLatch(threadCount);
            List<SystemConfigManager> instances = Collections.synchronizedList(new ArrayList<>());

            for (int i = 0; i < threadCount; i++) {
                executor.submit(() -> {
                    try {
                        startLatch.await(); // Wait for all threads to align
                        instances.add(SystemConfigManager.getInstance());
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    } finally {
                        doneLatch.countDown();
                    }
                });
            }

            startLatch.countDown(); // Release all threads simultaneously
            doneLatch.await();
            executor.shutdown();

            assertEquals(threadCount, instances.size());
            SystemConfigManager baseline = instances.get(0);
            for (SystemConfigManager instance : instances) {
                assertSame(baseline, instance, "Every concurrent thread must receive the exact same singleton instance");
            }
        }

        @Test
        @DisplayName("Direct constructor reflection instantiation should be blocked")
        void testReflectionProtection() throws Exception {
            Constructor<SystemConfigManager> constructor = SystemConfigManager.class.getDeclaredConstructor();
            constructor.setAccessible(true);

            InvocationTargetException exception = assertThrows(InvocationTargetException.class, constructor::newInstance);
            assertTrue(exception.getCause() instanceof IllegalStateException);
            assertTrue(exception.getCause().getMessage().contains("Instance đã tồn tại"));
        }

        @Test
        @DisplayName("Serialization and deserialization should preserve singleton instance via readResolve")
        void testSerializationSafety() throws Exception {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try (ObjectOutputStream oos = new ObjectOutputStream(baos)) {
                oos.writeObject(config);
            }

            ByteArrayInputStream bais = new ByteArrayInputStream(baos.toByteArray());
            SystemConfigManager deserialized;
            try (ObjectInputStream ois = new ObjectInputStream(bais)) {
                deserialized = (SystemConfigManager) ois.readObject();
            }

            assertSame(config, deserialized, "Deserialized instance must resolve to the existing singleton instance");
        }
    }

    @Nested
    @DisplayName("Business Operating Parameters Tests")
    class OperatingParametersTests {

        @Test
        @DisplayName("Should initialize correct default cafe operational parameters")
        void testDefaultValues() {
            assertAll(
                    () -> assertEquals("Đà Lạt Cafe", config.getStoreName()),
                    () -> assertEquals("Phường Cam Ly, TP. Đà Lạt, Lâm Đồng", config.getStoreAddress()),
                    () -> assertEquals("0263 382 2222", config.getStorePhone()),
                    () -> assertEquals(0.08, config.getVatRate(), 0.001),
                    () -> assertEquals(10000, config.getLoyaltyRateVndPerPoint()),
                    () -> assertEquals(1000, config.getPointRedeemValueVnd()),
                    () -> assertEquals(20, config.getMaxReservationGuests()),
                    () -> assertEquals(30, config.getAutoCancelMinutes()),
                    () -> assertEquals(LocalTime.of(7, 0), config.getOpeningTime()),
                    () -> assertEquals(LocalTime.of(22, 0), config.getClosingTime())
            );
        }

        @Test
        @DisplayName("isWithinOperatingHours should validate opening/closing boundaries accurately")
        void testOperatingHoursCheck() {
            // Before opening (07:00)
            assertFalse(config.isWithinOperatingHours(LocalTime.of(6, 59, 59)));
            assertFalse(config.isWithinOperatingHours(LocalTime.of(5, 0)));

            // Exact boundary opening (07:00)
            assertTrue(config.isWithinOperatingHours(LocalTime.of(7, 0)));

            // Middle of day
            assertTrue(config.isWithinOperatingHours(LocalTime.of(12, 30)));
            assertTrue(config.isWithinOperatingHours(LocalTime.of(18, 45)));

            // Exact boundary closing (22:00)
            assertTrue(config.isWithinOperatingHours(LocalTime.of(22, 0)));

            // After closing (22:00)
            assertFalse(config.isWithinOperatingHours(LocalTime.of(22, 0, 1)));
            assertFalse(config.isWithinOperatingHours(LocalTime.of(23, 30)));
        }

        @Test
        @DisplayName("isWithinOperatingHours(null) reads the café's clock, not the server's time zone")
        void testCurrentTimeUsesTheCafeTimeZone() {
            LocalTime cafeNow = LocalTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
            assumeTrue(cafeNow.isAfter(LocalTime.of(1, 0)) && cafeNow.isBefore(LocalTime.of(23, 0)),
                    "a one-hour window around now would wrap past midnight");
            config.setOpeningTime(cafeNow.minusMinutes(30));
            config.setClosingTime(cafeNow.plusMinutes(30));
            TimeZone serverZone = TimeZone.getDefault();
            // Bogotá is UTC-5 all year: twelve hours behind the café.
            TimeZone.setDefault(TimeZone.getTimeZone("America/Bogota"));
            try {
                assertTrue(config.isWithinOperatingHours(null));
            } finally {
                TimeZone.setDefault(serverZone);
            }
        }

        @Test
        @DisplayName("calculateLoyaltyPoints should convert order amounts into points correctly")
        void testLoyaltyPointCalculation() {
            assertEquals(0, config.calculateLoyaltyPoints(0.0));
            assertEquals(0, config.calculateLoyaltyPoints(-50000.0));
            assertEquals(0, config.calculateLoyaltyPoints(9999.0));

            assertEquals(1, config.calculateLoyaltyPoints(10000.0));
            assertEquals(4, config.calculateLoyaltyPoints(45000.0));
            assertEquals(12, config.calculateLoyaltyPoints(125000.0));
            assertEquals(100, config.calculateLoyaltyPoints(1000000.0));
        }

        @Test
        @DisplayName("calculateDiscountFromPoints should convert points into bill discount amount")
        void testPointDiscountCalculation() {
            assertEquals(0.0, config.calculateDiscountFromPoints(0));
            assertEquals(0.0, config.calculateDiscountFromPoints(-10));

            assertEquals(1000.0, config.calculateDiscountFromPoints(1));
            assertEquals(10000.0, config.calculateDiscountFromPoints(10));
            assertEquals(45000.0, config.calculateDiscountFromPoints(45));
        }

        @Test
        @DisplayName("Mutators and resetToDefaults should allow adjusting parameters and restoring")
        void testParameterMutationAndReset() {
            config.setStoreName("Đà Lạt Cafe - Chi nhánh Hồ Xuân Hương");
            config.setVatRate(0.10);
            config.setMaxReservationGuests(30);

            assertEquals("Đà Lạt Cafe - Chi nhánh Hồ Xuân Hương", config.getStoreName());
            assertEquals(0.10, config.getVatRate(), 0.001);
            assertEquals(30, config.getMaxReservationGuests());

            config.resetToDefaults();
            assertEquals("Đà Lạt Cafe", config.getStoreName());
            assertEquals(0.08, config.getVatRate(), 0.001);
            assertEquals(20, config.getMaxReservationGuests());
        }
    }
}
