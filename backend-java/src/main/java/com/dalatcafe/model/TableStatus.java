package com.dalatcafe.model;

/**
 * Trạng thái vận hành của một Table trên sơ đồ bàn.
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

