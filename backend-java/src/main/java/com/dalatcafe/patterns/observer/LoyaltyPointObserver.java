package com.dalatcafe.patterns.observer;

import com.dalatcafe.dao.ICustomerDao;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.patterns.singleton.SystemConfigManager;

import java.util.Objects;

public class LoyaltyPointObserver implements IOrderObserver {
    private final ICustomerDao customerDao;
    private final int customerId;

    public LoyaltyPointObserver(ICustomerDao customerDao, int customerId) {
        this.customerDao = Objects.requireNonNull(customerDao, "Customer DAO must not be null");
        if (customerId <= 0) {
            throw new IllegalArgumentException("Customer ID must be greater than zero");
        }
        this.customerId = customerId;
    }

    /** Points are earned as soon as the money is taken, not when the kitchen finishes. */
    @Override
    public void onOrderPaid(Order order) {
        Objects.requireNonNull(order, "Order must not be null");
        if (order.getPaymentStatus() != PaymentStatus.PAID) {
            return;
        }

        int earnedPoints = SystemConfigManager.getInstance().calculateLoyaltyPoints(order.getTotal());
        if (!customerDao.addOrderRecord(customerId, order.getTotal(), earnedPoints)) {
            throw new IllegalStateException("Customer not found: " + customerId);
        }
    }
}
