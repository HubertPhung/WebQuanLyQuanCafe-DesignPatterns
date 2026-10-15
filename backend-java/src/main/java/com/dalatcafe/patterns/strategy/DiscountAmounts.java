package com.dalatcafe.patterns.strategy;

final class DiscountAmounts {
    private DiscountAmounts() {}

    static double requireNonNegative(double value, String name) {
        if (!Double.isFinite(value) || value < 0) {
            throw new IllegalArgumentException(name + " must be finite and non-negative");
        }
        return value;
    }

    static double clamp(double subtotal, double discount) {
        requireNonNegative(subtotal, "Subtotal");
        requireNonNegative(discount, "Discount");
        return Math.min(subtotal, discount);
    }
}
