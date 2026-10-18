package com.dalatcafe.patterns.observer;

import com.dalatcafe.model.Order;

import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

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
        notifyAll(observer -> observer.onOrderPaid(order));
    }

    public void notifyOrderOpened(Order order) {
        Objects.requireNonNull(order, "Order must not be null");
        notifyAll(observer -> observer.onOrderOpened(order));
    }

    public void notifyOrderCompleted(Order order) {
        Objects.requireNonNull(order, "Order must not be null");
        notifyAll(observer -> observer.onOrderCompleted(order));
    }

    public void notifyOrderCancelled(Order order) {
        Objects.requireNonNull(order, "Order must not be null");
        notifyAll(observer -> observer.onOrderCancelled(order));
    }

    /**
     * Every observer hears the event even when an earlier one fails: a missing table must not
     * cost the kitchen its ticket. The first failure is rethrown afterwards, the rest suppressed.
     */
    private void notifyAll(Consumer<IOrderObserver> event) {
        RuntimeException failure = null;
        for (IOrderObserver observer : observers) {
            try {
                event.accept(observer);
            } catch (RuntimeException e) {
                if (failure == null) {
                    failure = e;
                } else {
                    failure.addSuppressed(e);
                }
            }
        }
        if (failure != null) {
            throw failure;
        }
    }
}
