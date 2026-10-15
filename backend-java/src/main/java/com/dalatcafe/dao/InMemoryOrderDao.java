package com.dalatcafe.dao;

import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.PaymentStatus;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * In-memory implementation of IOrderDao using thread-safe collection.
 */
public class InMemoryOrderDao implements IOrderDao {
    private final InMemoryDatabase db;

    public InMemoryOrderDao() {
        this(InMemoryDatabase.getInstance());
    }

    public InMemoryOrderDao(InMemoryDatabase db) {
        this.db = db;
    }

    @Override
    public List<Order> findAll() {
        return db.getOrders().values().stream()
                .sorted(Comparator.comparing(Order::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Order> findById(int id) {
        return Optional.ofNullable(db.getOrders().get(id));
    }

    @Override
    public Optional<Order> findByOrderCode(String orderCode) {
        if (orderCode == null) return Optional.empty();
        return db.getOrders().values().stream()
                .filter(o -> orderCode.equalsIgnoreCase(o.getOrderCode()))
                .findFirst();
    }

    @Override
    public List<Order> findByStatus(OrderStatus status) {
        if (status == null) return new ArrayList<>();
        return db.getOrders().values().stream()
                .filter(o -> o.getStatus() == status)
                .sorted(Comparator.comparing(Order::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    @Override
    public List<Order> findByTableId(int tableId) {
        return db.getOrders().values().stream()
                .filter(o -> o.getTableId() != null && o.getTableId() == tableId)
                .sorted(Comparator.comparing(Order::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    @Override
    public boolean save(Order order) {
        if (order == null) return false;
        if (order.getId() == null) {
            order.setId(db.generateOrderId());
        }
        if (order.getOrderCode() == null || order.getOrderCode().isBlank()) {
            order.setOrderCode("AC-" + String.format("%04d", order.getId()));
        }
        db.getOrders().put(order.getId(), order);
        return true;
    }

    @Override
    public boolean updateStatus(int id, OrderStatus status) {
        Order order = db.getOrders().get(id);
        if (order == null) return false;
        order.setStatus(status);
        return true;
    }

    @Override
    public boolean updatePaymentStatus(int id, PaymentStatus paymentStatus) {
        Order order = db.getOrders().get(id);
        if (order == null) return false;
        order.setPaymentStatus(paymentStatus);
        return true;
    }

    @Override
    public boolean deleteById(int id) {
        return db.getOrders().remove(id) != null;
    }
}

