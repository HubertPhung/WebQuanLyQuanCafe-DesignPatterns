package com.dalatcafe.patterns.observer;

import com.dalatcafe.model.Order;

import java.util.Objects;
import java.util.function.Consumer;

public class KitchenNotificationObserver implements IOrderObserver {
    private final Consumer<String> notificationSink;

    public KitchenNotificationObserver() {
        this(System.out::println);
    }

    public KitchenNotificationObserver(Consumer<String> notificationSink) {
        this.notificationSink = Objects.requireNonNull(notificationSink, "Notification sink must not be null");
    }

    @Override
    public void onOrderCompleted(Order order) {
        Objects.requireNonNull(order, "Order must not be null");
        notificationSink.accept("Order " + order.getOrderCode() + " completed; remove it from KDS");
    }
}
