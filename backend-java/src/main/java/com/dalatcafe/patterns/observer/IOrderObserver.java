package com.dalatcafe.patterns.observer;

import com.dalatcafe.model.Order;

import java.util.Objects;
import java.util.function.Consumer;

/**
 * Observer for the two order lifecycle events: paid at the POS, then completed by the kitchen
 * (KDS). Both default to no-ops so each observer reacts only to the events it cares about.
 */
public interface IOrderObserver {
    /** An unpaid order was opened; its table is already in use. */
    default void onOrderOpened(Order order) {
    }

    /** The order was paid and saved; it now waits for the barista. */
    default void onOrderPaid(Order order) {
    }

    /** The kitchen finished the order and it left the KDS board. */
    default void onOrderCompleted(Order order) {
    }

    /** The order was cancelled and must leave the kitchen queue. */
    default void onOrderCancelled(Order order) {
    }

    /** Observer that only reacts to {@link #onOrderPaid(Order)}. */
    static IOrderObserver whenPaid(Consumer<Order> action) {
        Objects.requireNonNull(action, "Action must not be null");
        return new IOrderObserver() {
            @Override
            public void onOrderPaid(Order order) {
                action.accept(order);
            }
        };
    }

    /** Observer that only reacts to {@link #onOrderCompleted(Order)}. */
    static IOrderObserver whenCompleted(Consumer<Order> action) {
        Objects.requireNonNull(action, "Action must not be null");
        return new IOrderObserver() {
            @Override
            public void onOrderCompleted(Order order) {
                action.accept(order);
            }
        };
    }
}
