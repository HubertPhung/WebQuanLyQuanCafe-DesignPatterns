package com.dalatcafe.model;

/**
 * Operational status of a Table on the Floor Plan.
 */
public enum TableStatus {
    AVAILABLE("Bàn trống"),
    OCCUPIED("Đang có khách"),
    RESERVED("Đã đặt trước"),
    CLEANING("Đang dọn dẹp");

    private final String description;

    TableStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}

