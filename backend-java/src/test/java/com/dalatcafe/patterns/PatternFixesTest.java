package com.dalatcafe.patterns;

import com.dalatcafe.dao.InMemoryConfigDao;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.patterns.builder.OrderBuilder;
import com.dalatcafe.patterns.decorator.BaseCoffee;
import com.dalatcafe.patterns.observer.IOrderObserver;
import com.dalatcafe.patterns.observer.KitchenNotificationObserver;
import com.dalatcafe.patterns.observer.OrderEventSubject;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Covers the three fixes: settings that survive a restart, the Builder's discount step, observer order. */
class PatternFixesTest {

    @AfterEach
    void detachStore() {
        SystemConfigManager config = SystemConfigManager.getInstance();
        config.attachStore(null);
        config.resetToDefaults();
    }

    // ---- Singleton: persistence ----

    @Test
    void settingsSurviveARestart() {
        SystemConfigManager config = SystemConfigManager.getInstance();
        InMemoryConfigDao store = new InMemoryConfigDao();
        config.attachStore(store);
        config.setStoreName("Đà Lạt Cafe - Chi nhánh 2");
        config.setOpeningTime(LocalTime.of(6, 30));
        config.setMaxReservationGuests(35);
        assertTrue(config.persist());

        config.resetToDefaults(); // what a fresh process starts with
        assertEquals("Đà Lạt Cafe", config.getStoreName());

        config.attachStore(store); // what main() does on startup
        assertEquals("Đà Lạt Cafe - Chi nhánh 2", config.getStoreName());
        assertEquals(LocalTime.of(6, 30), config.getOpeningTime());
        assertEquals(35, config.getMaxReservationGuests());
    }

    @Test
    void persistWithoutAStoreReportsFailure() {
        assertFalse(SystemConfigManager.getInstance().persist());
    }

    @Test
    void unreadableSavedValueKeepsTheCurrentOne() {
        InMemoryConfigDao store = new InMemoryConfigDao();
        store.saveAll(java.util.Map.of("openingTime", "not-a-time", "maxReservationGuests", "42"));
        SystemConfigManager config = SystemConfigManager.getInstance();
        config.attachStore(store);
        assertEquals(SystemConfigManager.DEFAULT_OPENING_TIME, config.getOpeningTime());
        assertEquals(42, config.getMaxReservationGuests());
    }

    // ---- Builder: discount is a build step ----

    @Test
    void builderComputesTheDiscountFromTheFinishedSubtotal() {
        MenuItem item = new MenuItem(1, "Salted Cream Coffee", "Coffee", 55_000, 20_000);
        Order order = new OrderBuilder()
                .addItem(1, new BaseCoffee(item), 2)
                .discountedBy(subtotal -> subtotal * 0.10)
                .build();
        assertEquals(110_000, order.getSubtotal(), 0.001);
        assertEquals(11_000, order.getDiscountAmount(), 0.001);
    }

    @Test
    void builderRejectsAnInvalidDiscountRule() {
        MenuItem item = new MenuItem(1, "Salted Cream Coffee", "Coffee", 55_000, 20_000);
        OrderBuilder builder = new OrderBuilder()
                .addItem(1, new BaseCoffee(item), 1)
                .discountedBy(subtotal -> -5);
        assertThrows(IllegalStateException.class, builder::build);
    }

    // ---- Observer: priority and failure isolation ----

    @Test
    void observersAreToldInPriorityOrderNotAttachOrder() {
        List<String> calls = new ArrayList<>();
        OrderEventSubject subject = new OrderEventSubject();
        subject.attach(recorder("kitchen", calls), 90);
        subject.attach(recorder("table", calls), 10);
        subject.attach(recorder("default", calls));
        subject.notifyOrderPaid(sampleOrder());
        assertEquals(List.of("table", "kitchen", "default"), calls);
    }

    @Test
    void failingObserverDoesNotStopTheOthers() {
        List<String> calls = new ArrayList<>();
        OrderEventSubject subject = new OrderEventSubject();
        subject.attach(new IOrderObserver() {
            @Override
            public void onOrderPaid(Order order) {
                throw new IllegalStateException("table missing");
            }
        }, 10);
        subject.attach(recorder("kitchen", calls), 90);
        assertThrows(IllegalStateException.class, () -> subject.notifyOrderPaid(sampleOrder()));
        assertEquals(List.of("kitchen"), calls);
    }

    @Test
    void kitchenObserverDefaultsToTheLogNotTheConsole() {
        // Constructing with the default sink must not throw and must accept events.
        new KitchenNotificationObserver().onOrderPaid(sampleOrder());
    }

    private static IOrderObserver recorder(String name, List<String> calls) {
        return new IOrderObserver() {
            @Override
            public void onOrderPaid(Order order) {
                calls.add(name);
            }
        };
    }

    private static Order sampleOrder() {
        MenuItem item = new MenuItem(1, "Salted Cream Coffee", "Coffee", 55_000, 20_000);
        return new OrderBuilder().addItem(1, new BaseCoffee(item), 1).build();
    }
}
