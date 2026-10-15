package com.dalatcafe.patterns.observer;

import com.dalatcafe.model.Order;

@FunctionalInterface
public interface IOrderObserver {
    void onOrderCompleted(Order order);
}
