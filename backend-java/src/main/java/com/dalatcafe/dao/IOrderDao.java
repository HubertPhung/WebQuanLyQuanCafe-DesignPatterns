package com.dalatcafe.dao;

import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.model.PaymentMethod;

import java.util.List;
import java.util.Optional;

/**
 * Data Access Object interface for Order entity.
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
    /** All rows must still be unpaid; implementations commit every payment status together. */
    default boolean markPaidTogether(List<Integer> ids, PaymentMethod method, java.util.function.BooleanSupplier payment) { return false; }
    boolean deleteById(int id);
}

