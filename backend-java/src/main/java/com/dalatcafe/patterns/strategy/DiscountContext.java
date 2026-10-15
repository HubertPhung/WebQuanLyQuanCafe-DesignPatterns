package com.dalatcafe.patterns.strategy;

import com.dalatcafe.model.Customer;
import java.util.Objects;

public final class DiscountContext {
    private IDiscountStrategy strategy;

    public DiscountContext() {
        this(new NoDiscountStrategy());
    }

    public DiscountContext(IDiscountStrategy strategy) {
        setStrategy(strategy);
    }

    public void setStrategy(IDiscountStrategy strategy) {
        this.strategy = Objects.requireNonNull(strategy, "Strategy must not be null");
    }

    public double executeDiscount(double subtotal, Customer customer) {
        DiscountAmounts.requireNonNegative(subtotal, "Subtotal");
        return DiscountAmounts.clamp(subtotal, strategy.calculateDiscount(subtotal, customer));
    }

    public String getDiscountDescription() {
        return strategy.getDiscountDescription();
    }
}
