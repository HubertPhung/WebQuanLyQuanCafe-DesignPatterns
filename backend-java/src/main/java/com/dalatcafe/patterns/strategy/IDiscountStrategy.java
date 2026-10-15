package com.dalatcafe.patterns.strategy;

import com.dalatcafe.model.Customer;

/** Computes a monetary deduction, never greater than the subtotal. */
public interface IDiscountStrategy {
    double calculateDiscount(double subtotal, Customer customer);
    String getDiscountDescription();
}
