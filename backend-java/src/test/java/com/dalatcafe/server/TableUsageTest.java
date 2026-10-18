package com.dalatcafe.server;

import com.dalatcafe.model.*;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TableUsageTest {
    private final Instant now = Instant.parse("2026-10-19T02:00:00Z");
    private final Table table = new Table(3, "Table 3", 4, "Main");

    @BeforeEach
    void resetConfiguration() {
        SystemConfigManager.getInstance().resetToDefaults();
    }

    @Test
    void unpaidGroupOrderOccupiesSecondaryTableDespiteStaleFlag() {
        Order order = new Order(null, "GROUP", "Guest", 1, OrderType.DINE_IN);
        order.setTableIds(List.of(1, 3));
        assertEquals(TableStatus.OCCUPIED, TableUsage.status(table, List.of(order), List.of(), now));
        order.setStatus(OrderStatus.CANCELLED);
        assertEquals(TableStatus.AVAILABLE, TableUsage.status(table, List.of(order), List.of(), now));
        order.setStatus(OrderStatus.COMPLETED);
        order.setPaymentStatus(PaymentStatus.PAID);
        assertEquals(TableStatus.AVAILABLE, TableUsage.status(table, List.of(order), List.of(), now));
    }

    @Test
    void upcomingReservationBlocksItsGroupUntilNoShowGraceEnds() {
        Reservation booking = new Reservation(null, "RES", "Guest", "0901234567", now.plusSeconds(1800), 4);
        booking.setTableIds(List.of(1, 3));
        assertEquals(TableStatus.RESERVED, TableUsage.status(table, List.of(), List.of(booking), now));
        assertEquals(TableStatus.RESERVED, TableUsage.status(table, List.of(), List.of(booking), now.plusSeconds(2699)));
        assertEquals(TableStatus.AVAILABLE, TableUsage.status(table, List.of(), List.of(booking), now.plusSeconds(2700)));
        booking.setDateTime(now.plusSeconds(86400));
        assertEquals(TableStatus.AVAILABLE, TableUsage.status(table, List.of(), List.of(booking), now));
        booking.setStatus(ReservationStatus.CANCELLED);
        assertEquals(TableStatus.AVAILABLE, TableUsage.status(table, List.of(), List.of(booking), now));
    }

    @Test
    void manualCleaningAndReservedStatesRemainUnavailable() {
        table.setStatus(TableStatus.CLEANING);
        assertEquals(TableStatus.CLEANING, TableUsage.status(table, List.of(), List.of(), now));
        table.setStatus(TableStatus.RESERVED);
        assertEquals(TableStatus.RESERVED, TableUsage.status(table, List.of(), List.of(), now));
    }
}
