package com.dalatcafe.server;

import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.model.Reservation;
import com.dalatcafe.model.ReservationStatus;
import com.dalatcafe.model.Table;
import com.dalatcafe.model.TableStatus;
import com.dalatcafe.patterns.chain.TableAvailabilityValidator;
import com.dalatcafe.patterns.singleton.SystemConfigManager;

import java.time.Instant;
import java.util.List;

/** Current floor usage includes unpaid tabs, even if an earlier observer missed the table update. */
final class TableUsage {
    private TableUsage() {}

    static TableStatus status(Table table, List<Order> orders, List<Reservation> reservations, Instant now) {
        boolean open = orders.stream().anyMatch(order -> order.getTableIds().contains(table.getId())
                && order.getStatus() != OrderStatus.CANCELLED
                && (order.getStatus() != OrderStatus.COMPLETED || order.getPaymentStatus() == PaymentStatus.UNPAID));
        if (open) return TableStatus.OCCUPIED;
        if (table.getStatus() != TableStatus.AVAILABLE) return table.getStatus();
        int grace = SystemConfigManager.getInstance().getAutoCancelMinutes();
        boolean reserved = reservations.stream().anyMatch(reservation -> reservation.getTableIds().contains(table.getId())
                && (reservation.getStatus() == ReservationStatus.PENDING || reservation.getStatus() == ReservationStatus.CONFIRMED)
                && !reservation.isNoShowAt(now, grace)
                && (reservation.getDateTime() == null || TableAvailabilityValidator.slotsOverlap(
                        now, reservation.getDateTime(), TableAvailabilityValidator.DEFAULT_DURATION)));
        return reserved ? TableStatus.RESERVED : TableStatus.AVAILABLE;
    }
}
