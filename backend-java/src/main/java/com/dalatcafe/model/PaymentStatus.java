package com.dalatcafe.model;

/**
 * Trạng thái thanh toán của một Order.
 */
public enum PaymentStatus {
    UNPAID("Chưa thanh toán"),
    PAID("Đã thanh toán"),
    REFUNDED("Đã hoàn tiền");

    private final String description;

    PaymentStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}

