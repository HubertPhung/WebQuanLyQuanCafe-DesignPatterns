package com.dalatcafe.patterns.strategy;

import com.dalatcafe.model.Customer;

public final class PercentageDiscountStrategy implements IDiscountStrategy {
    private final double rate;
    private final double maxCap;

    /** @param rate tỷ lệ giảm, từ 0 đến 1 */
    public PercentageDiscountStrategy(double rate, double maxCap) {
        DiscountAmounts.requireNonNegative(rate, "Rate");
        if (rate > 1) {
            throw new IllegalArgumentException("Rate must not exceed one");
        }
        this.rate = rate;
        this.maxCap = DiscountAmounts.requireNonNegative(maxCap, "Maximum cap");
    }

    @Override
    public double calculateDiscount(double subtotal, Customer customer) {
        DiscountAmounts.requireNonNegative(subtotal, "Subtotal");
        return DiscountAmounts.clamp(subtotal, Math.min(subtotal * rate, maxCap));
    }

    @Override
    public String getDiscountDescription() {
        return "Giảm " + (rate * 100) + "%, tối đa " + maxCap + " VND";
    }
}
