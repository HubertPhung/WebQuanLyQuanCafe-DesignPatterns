package com.dalatcafe.patterns.strategy;

import com.dalatcafe.model.Customer;

/** Tính một khoản giảm tiền, không bao giờ lớn hơn tạm tính. */
public interface IDiscountStrategy {
    double calculateDiscount(double subtotal, Customer customer);
    String getDiscountDescription();
}
