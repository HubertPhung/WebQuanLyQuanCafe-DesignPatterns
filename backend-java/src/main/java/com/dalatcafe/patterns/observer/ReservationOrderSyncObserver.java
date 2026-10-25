package com.dalatcafe.patterns.observer;

import com.dalatcafe.dao.IReservationDao;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.ReservationStatus;

import java.util.Objects;

/** Giữ lịch sử của phiếu đặt bàn đã nhận bàn khớp với thực tế khi phiếu POS của nó bị hủy. */
public class ReservationOrderSyncObserver implements IOrderObserver {
    private final IReservationDao reservations;

    public ReservationOrderSyncObserver(IReservationDao reservations) {
        this.reservations = Objects.requireNonNull(reservations);
    }

    @Override
    public void onOrderCancelled(Order order) {
        reservations.findByReservationCode(order.getOrderCode())
                .filter(reservation -> reservation.getStatus() == ReservationStatus.SEATED)
                .ifPresent(reservation -> {
                    if (!reservations.updateStatus(reservation.getId(), ReservationStatus.CANCELLED)) {
                        throw new IllegalStateException("Could not cancel reservation " + order.getOrderCode());
                    }
                });
    }
}
