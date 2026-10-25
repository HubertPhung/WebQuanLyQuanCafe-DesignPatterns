package com.dalatcafe.patterns.observer;

import com.dalatcafe.model.Order;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.logging.Logger;

public class KitchenNotificationObserver implements IOrderObserver {
    private static final Logger LOGGER = Logger.getLogger(KitchenNotificationObserver.class.getName());

    private final Consumer<String> notificationSink;

    /** Đích mặc định là log của ứng dụng; truyền một đích khác để gửi phiếu tới màn hình thật. */
    public KitchenNotificationObserver() {
        this(LOGGER::info);
    }

    public KitchenNotificationObserver(Consumer<String> notificationSink) {
        this.notificationSink = Objects.requireNonNull(notificationSink, "Notification sink must not be null");
    }

    @Override
    public void onOrderPaid(Order order) {
        Objects.requireNonNull(order, "Order must not be null");
        notificationSink.accept("Order " + order.getOrderCode() + " paid; new KDS ticket");
    }

    @Override
    public void onOrderCompleted(Order order) {
        Objects.requireNonNull(order, "Order must not be null");
        notificationSink.accept("Order " + order.getOrderCode() + " completed; remove it from KDS");
    }

    @Override
    public void onOrderCancelled(Order order) {
        Objects.requireNonNull(order, "Order must not be null");
        notificationSink.accept("Order " + order.getOrderCode() + " cancelled; remove it from KDS");
    }
}
