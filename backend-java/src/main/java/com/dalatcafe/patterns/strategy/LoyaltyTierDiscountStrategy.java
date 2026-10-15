package com.dalatcafe.patterns.strategy;

import com.dalatcafe.model.Customer;

public final class LoyaltyTierDiscountStrategy implements IDiscountStrategy {
    @Override
    public double calculateDiscount(double subtotal, Customer customer) {
        DiscountAmounts.requireNonNegative(subtotal, "Subtotal");
        double rate = customer == null || customer.getRank() == null
                ? 0 : customer.getRank().getDiscountRate();
        return DiscountAmounts.clamp(subtotal, subtotal * rate);
    }

    @Override
    public String getDiscountDescription() {
        return "Giảm theo hạng thành viên: Đồng 0%, Bạc 5%, Vàng 10%, VIP 15%";
    }
}
