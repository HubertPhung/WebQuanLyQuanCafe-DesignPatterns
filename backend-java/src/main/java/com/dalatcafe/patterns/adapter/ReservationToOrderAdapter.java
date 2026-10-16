package com.dalatcafe.patterns.adapter;

import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderItem;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.OrderType;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.model.Reservation;

import java.util.Objects;

/**
 * Object Adapter (GoF Structural): adapts an approved {@link Reservation} (Adaptee)
 * to the POS {@link IPosOrderTarget} so a guest's pre-ordered drinks become an active order.
 * Neither Reservation nor Order is modified; the adaptee is only read.
 */
public class ReservationToOrderAdapter implements IPosOrderTarget {
    private final Reservation reservation;

    public ReservationToOrderAdapter(Reservation reservation) {
        this.reservation = Objects.requireNonNull(reservation, "reservation must not be null");
    }

    @Override
    public Order toPosOrder() {
        Order order = new Order(null, reservation.getReservationCode(), getCustomerIdentifier(),
                reservation.getTableId(), OrderType.DINE_IN);
        order.setStatus(OrderStatus.PENDING);
        order.setPaymentStatus(PaymentStatus.UNPAID);
        order.setNote(reservation.getNote());

        if (reservation.getPreOrders() != null) {
            for (OrderItem source : reservation.getPreOrders()) {
                if (source != null) {
                    order.addItem(copyOf(source));
                }
            }
        }
        order.recalculateTotals();
        return order;
    }

    @Override
    public int getAssignedTableId() {
        return reservation.getTableId() != null ? reservation.getTableId() : -1;
    }

    @Override
    public String getCustomerIdentifier() {
        String name = reservation.getCustomer();
        return name != null && !name.isBlank() ? name : reservation.getContact();
    }

    private static OrderItem copyOf(OrderItem item) {
        return new OrderItem(item.getMenuItemId(), item.getName(), item.getQty(),
                item.getPrice(), item.getVariation(), item.getNotes());
    }
}
