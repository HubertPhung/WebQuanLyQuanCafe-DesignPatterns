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
 * Subject của Observer pattern. Danh sách dùng copy-on-write vì checkout gắn observer theo từng
 * khách trong khi các luồng request khác có thể đang phát sự kiện. Observer được báo theo thứ tự ưu
 * tiên (số nhỏ trước, cùng ưu tiên thì theo thứ tự gắn), nên một phụ thuộc như "cập nhật bàn trước
 * khi quầy thấy phiếu" được ghi rõ ở chỗ gắn observer, không phó mặc cho thứ tự các dòng attach.
 */
public class OrderEventSubject {
    /** Mức ưu tiên mà {@link #attach(IOrderObserver)} dùng. */
    public static final int DEFAULT_PRIORITY = 100;

    private static final Logger LOGGER = Logger.getLogger(OrderEventSubject.class.getName());

    private record Entry(IOrderObserver observer, int priority) { }

    private final CopyOnWriteArrayList<Entry> observers = new CopyOnWriteArrayList<>();

    public void attach(IOrderObserver observer) {
        attach(observer, DEFAULT_PRIORITY);
    }

    /** Số ưu tiên nhỏ hơn được báo trước. Gắn cùng một observer hai lần thì giữ lần đầu. */
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
     * Mọi observer đều nhận sự kiện kể cả khi một observer trước đó lỗi: thiếu bàn không được làm
     * quầy pha chế mất phiếu. Mỗi lỗi được ghi log kèm tên observer; lỗi đầu tiên được ném lại sau
     * cùng, các lỗi sau gộp vào dạng suppressed.
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
