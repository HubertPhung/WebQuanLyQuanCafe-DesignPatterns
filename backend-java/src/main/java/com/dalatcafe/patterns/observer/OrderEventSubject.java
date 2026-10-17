package com.dalatcafe.patterns.observer;

import com.dalatcafe.model.Order;

import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Subject of the Observer pattern. The list is copy-on-write because checkout attaches a
 * per-customer observer while other request threads may be broadcasting.
 */
public class OrderEventSubject {
    private final CopyOnWriteArrayList<IOrderObserver> observers = new CopyOnWriteArrayList<>();

    public void attach(IOrderObserver observer) {
        Objects.requireNonNull(observer, "Observer must not be null");
        observers.addIfAbsent(observer);
    }

    public void detach(IOrderObserver observer) {
        observers.remove(observer);
    }

    public void notifyOrderPaid(Order order) {
        Objects.requireNonNull(order, "Order must not be null");
        for (IOrderObserver observer : observers) {
            observer.onOrderPaid(order);
        }
    }

    public void notifyOrderCompleted(Order order) {
        Objects.requireNonNull(order, "Order must not be null");
        for (IOrderObserver observer : observers) {
            observer.onOrderCompleted(order);
        }
    }
}
