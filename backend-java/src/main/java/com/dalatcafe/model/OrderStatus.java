package com.dalatcafe.model;

/**
 * Lifecycle status of an Order in Đà Lạt Cafe system.
 */
public enum OrderStatus {
    PENDING("Chờ xác nhận / Chờ pha chế"),
    BREWING("Đang pha chế"),
    READY("Đã pha chế xong"),
    COMPLETED("Hoàn thành"),
    CANCELLED("Đã hủy");

    private final String description;

    OrderStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}

