package com.dalatcafe.model;

/**
 * Hình thức nhận đơn của một Order.
 */
public enum OrderType {
    DINE_IN("Dùng tại quán"),
    PICKUP("Mang đi (Takeaway / Pickup)"),
    DELIVERY("Giao hàng tận nơi");

    private final String description;

    OrderType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}

