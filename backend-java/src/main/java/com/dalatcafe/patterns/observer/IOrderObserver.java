package com.dalatcafe.patterns.observer;

import com.dalatcafe.model.Order;

import java.util.Objects;
import java.util.function.Consumer;

/**
 * Observer cho hai sự kiện trong vòng đời đơn: thanh toán ở POS, rồi quầy pha chế (KDS) hoàn tất.
 * Cả hai mặc định không làm gì, để mỗi observer chỉ phản ứng với sự kiện nó quan tâm.
 */
public interface IOrderObserver {
    /** Một đơn chưa thanh toán vừa được mở; bàn của nó đã có khách. */
    default void onOrderOpened(Order order) {
    }

    /** Đơn đã được thanh toán và lưu; giờ chờ barista pha chế. */
    default void onOrderPaid(Order order) {
    }

    /** Quầy pha chế đã làm xong đơn và đơn rời bảng KDS. */
    default void onOrderCompleted(Order order) {
    }

    /** Đơn đã bị hủy và phải rời hàng chờ pha chế. */
    default void onOrderCancelled(Order order) {
    }

    /** Observer chỉ phản ứng với {@link #onOrderPaid(Order)}. */
    static IOrderObserver whenPaid(Consumer<Order> action) {
        Objects.requireNonNull(action, "Action must not be null");
        return new IOrderObserver() {
            @Override
            public void onOrderPaid(Order order) {
                action.accept(order);
            }
        };
    }

    /** Observer chỉ phản ứng với {@link #onOrderCompleted(Order)}. */
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
