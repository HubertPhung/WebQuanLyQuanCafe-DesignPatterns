package com.dalatcafe.model;

/**
 * Status of a table reservation request.
 */
public enum ReservationStatus {
    PENDING("Chờ xác nhận"),
    CONFIRMED("Đã xác nhận đặt bàn"),
    SEATED("Khách đã nhận bàn"),
    CANCELLED("Đã hủy");

    private final String description;

    ReservationStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}

