package com.dalatcafe.patterns.builder;

import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderItem;
import com.dalatcafe.model.OrderType;
import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.patterns.decorator.IBeverage;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

public class OrderBuilder {
    private String customerName = "Walk-in";
    private Integer tableId;
    private OrderType orderType = OrderType.DINE_IN;
    private final List<OrderItem> items = new ArrayList<>();
    private String note;
    private PaymentMethod paymentMethod = PaymentMethod.CASH;
    private PaymentStatus paymentStatus = PaymentStatus.UNPAID;
    private double discountAmount;

    public OrderBuilder forCustomer(String customerName) {
        this.customerName = customerName == null || customerName.isBlank() ? "Walk-in" : customerName.trim();
        return this;
    }

    public OrderBuilder atTable(int tableId) {
        if (tableId <= 0) {
            throw new IllegalArgumentException("Table ID must be greater than zero");
        }
        this.tableId = tableId;
        return this;
    }

    public OrderBuilder ofType(OrderType type) {
        this.orderType = Objects.requireNonNull(type, "Order type must not be null");
        return this;
    }

    public OrderBuilder addItem(IBeverage beverage, int quantity) {
        Objects.requireNonNull(beverage, "Beverage must not be null");
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than zero");
        }
        double cost = beverage.getCost();
        if (!Double.isFinite(cost) || cost < 0) {
            throw new IllegalArgumentException("Beverage cost must be a non-negative finite value");
        }
        items.add(new OrderItem(beverage.getDescription(), quantity, cost));
        return this;
    }

    public OrderBuilder withNote(String note) {
        this.note = note;
        return this;
    }

    public OrderBuilder withPayment(PaymentMethod method, boolean paid) {
        this.paymentMethod = Objects.requireNonNull(method, "Payment method must not be null");
        this.paymentStatus = paid ? PaymentStatus.PAID : PaymentStatus.UNPAID;
        return this;
    }

    public OrderBuilder applyDiscount(double discountAmount) {
        if (!Double.isFinite(discountAmount) || discountAmount < 0) {
            throw new IllegalArgumentException("Discount amount must be a non-negative finite value");
        }
        this.discountAmount = discountAmount;
        return this;
    }

    public Order build() {
        if (items.isEmpty()) {
            throw new IllegalStateException("Order must contain at least one item");
        }

        Order order = new Order(null, generateOrderCode(), customerName, tableId, orderType);
        order.setItems(items);
        order.setNote(note);
        order.setPaymentMethod(paymentMethod);
        order.setPaymentStatus(paymentStatus);
        order.setDiscountAmount(discountAmount);
        return order;
    }

    private String generateOrderCode() {
        String value = UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT);
        return "AC-" + value.substring(0, 4) + "-" + value.substring(4, 7);
    }
}
