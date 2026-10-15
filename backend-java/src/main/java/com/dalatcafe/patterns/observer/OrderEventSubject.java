package com.dalatcafe.patterns.observer;

import com.dalatcafe.model.Order;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class OrderEventSubject {
    private final List<IOrderObserver> observers = new ArrayList<>();

    public void attach(IOrderObserver observer) {
        Objects.requireNonNull(observer, "Observer must not be null");
        if (!observers.contains(observer)) {
            observers.add(observer);
        }
    }

    public void detach(IOrderObserver observer) {
        observers.remove(observer);
    }

    public void notifyOrderCompleted(Order order) {
        Objects.requireNonNull(order, "Order must not be null");
        for (IOrderObserver observer : List.copyOf(observers)) {
            observer.onOrderCompleted(order);
        }
    }
}
