package com.dalatcafe.patterns.strategy;

import com.dalatcafe.model.Customer;

public final class FixedAmountDiscountStrategy implements IDiscountStrategy {
    private final double amount;

    public FixedAmountDiscountStrategy(double amount) {
        this.amount = DiscountAmounts.requireNonNegative(amount, "Fixed amount");
    }

    @Override
    public double calculateDiscount(double subtotal, Customer customer) {
        return DiscountAmounts.clamp(subtotal, amount);
    }

    @Override
    public String getDiscountDescription() {
        return "Giảm " + amount + " VND";
    }
}
