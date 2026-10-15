package com.dalatcafe.patterns.strategy;

import com.dalatcafe.model.Customer;

public final class NoDiscountStrategy implements IDiscountStrategy {
    @Override
    public double calculateDiscount(double subtotal, Customer customer) {
        return DiscountAmounts.clamp(subtotal, 0);
    }

    @Override
    public String getDiscountDescription() {
        return "Không giảm giá";
    }
}
