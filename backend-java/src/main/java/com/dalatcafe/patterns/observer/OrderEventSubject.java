package com.dalatcafe.patterns.observer;

import com.dalatcafe.model.Order;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Subject of the Observer pattern. The list is copy-on-write because checkout attaches a
 * per-customer observer while other request threads may be broadcasting.
 *
 * Observers are told in priority order (lower number first, attach order inside one priority),
 * so a dependency such as "update the table before the kitchen sees the ticket" is written down
 * in the code that attaches them, not left to the order of the attach lines.
 */
public class OrderEventSubject {
    /** Priority used by {@link #attach(IOrderObserver)}. */
    public static final int DEFAULT_PRIORITY = 100;

    private static final Logger LOGGER = Logger.getLogger(OrderEventSubject.class.getName());

    private record Entry(IOrderObserver observer, int priority) { }

    private final CopyOnWriteArrayList<Entry> observers = new CopyOnWriteArrayList<>();

    public void attach(IOrderObserver observer) {
        attach(observer, DEFAULT_PRIORITY);
    }

    /** Lower priority numbers are notified first. Attaching the same observer twice keeps the first. */
    public synchronized void attach(IOrderObserver observer, int priority) {
        Objects.requireNonNull(observer, "Observer must not be null");
        for (Entry entry : observers) {
            if (entry.observer().equals(observer)) {
                return;
            }
        }
        List<Entry> sorted = new ArrayList<>(observers);
        int index = sorted.size();
        for (int i = 0; i < sorted.size(); i++) {
            if (sorted.get(i).priority() > priority) {
                index = i;
                break;
            }
        }
        sorted.add(index, new Entry(observer, priority));
        observers.clear();
        observers.addAll(sorted);
    }

    public synchronized void detach(IOrderObserver observer) {
        observers.removeIf(entry -> entry.observer().equals(observer));
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
     * cost the kitchen its ticket. Each failure is logged with the observer's name; the first is
     * rethrown afterwards, the rest suppressed.
     */
    private void notifyAll(Consumer<IOrderObserver> event) {
        RuntimeException failure = null;
        for (Entry entry : observers) {
            try {
                event.accept(entry.observer());
            } catch (RuntimeException e) {
                Class<?> type = entry.observer().getClass();
                String name = type.getSimpleName().isEmpty() ? type.getName() : type.getSimpleName();
                LOGGER.log(Level.WARNING, "Observer " + name + " failed: " + e.getMessage(), e);
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
