package com.dalatcafe.dao;

import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.model.PaymentMethod;

import java.util.List;
import java.util.Optional;

/**
 * Interface Data Access Object cho thực thể Order.
 */
public interface IOrderDao {
    List<Order> findAll();
    Optional<Order> findById(int id);
    Optional<Order> findByOrderCode(String orderCode);
    List<Order> findByStatus(OrderStatus status);
    List<Order> findByTableId(int tableId);
    boolean save(Order order);
    boolean updateStatus(int id, OrderStatus status);
    boolean updatePaymentStatus(int id, PaymentStatus paymentStatus);
    /**
     * Mọi dòng phải còn chưa thanh toán; bản cài đặt ghi trạng thái thanh toán của tất cả cùng lúc.
     */
    default boolean markPaidTogether(List<Integer> ids, PaymentMethod method, java.util.function.BooleanSupplier payment) { return false; }
    boolean deleteById(int id);
}

