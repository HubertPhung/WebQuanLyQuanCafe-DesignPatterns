package com.dalatcafe.model;

/**
 * Membership loyalty rank for cafe customers.
 */
public enum CustomerRank {
    BRONZE("Thành viên Đồng", 0.0),
    SILVER("Thành viên Bạc", 0.05),
    GOLD("Thành viên Vàng", 0.10),
    VIP("Thành viên Kim Cương / VIP", 0.15);

    private final String description;
    private final double discountRate;

    CustomerRank(String description, double discountRate) {
        this.description = description;
        this.discountRate = discountRate;
    }

    public String getDescription() {
        return description;
    }

    public double getDiscountRate() {
        return discountRate;
    }
}

