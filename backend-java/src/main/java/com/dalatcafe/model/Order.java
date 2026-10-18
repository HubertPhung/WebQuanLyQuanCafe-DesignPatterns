package com.dalatcafe.model;

import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Order entity representing a sales transaction in POS or Storefront.
 */
public class Order implements Serializable {
    private static final long serialVersionUID = 1L;

    public static final double DEFAULT_VAT_RATE = 0.08; // 8% VAT
    public static final double DELIVERY_FEE = 10_000;

    private Integer id;
    private String orderCode;
    private String customer;
    private Integer tableId;
    private List<Integer> tableIds = List.of();
    private String branch = Branches.DEFAULT;

    public String getBranch() {
        return branch;
    }

    public void setBranch(String branch) {
        this.branch = Branches.orDefault(branch);
    }

    public List<Integer> getTableIds() {
        return tableIds.isEmpty() ? (tableId == null ? List.of() : List.of(tableId)) : List.copyOf(tableIds);
    }

    public void setTableIds(List<Integer> ids) {
        tableIds = ids == null ? List.of() : ids.stream().distinct().toList();
        if (!tableIds.isEmpty()) tableId = tableIds.get(0);
    }
    private OrderType orderType;
    private List<OrderItem> items;
    private double subtotal;
    private double vatRate;
    private double vatAmount;
    private double discountAmount;
    private double total;
    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    private OrderStatus status;
    private String note;
    private Instant createdAt;
    private Instant completedAt;

    public Order() {
        this.customer = "Walk-in";
        this.orderType = OrderType.DINE_IN;
        this.items = new ArrayList<>();
        this.vatRate = DEFAULT_VAT_RATE;
        this.paymentMethod = PaymentMethod.CASH;
        this.paymentStatus = PaymentStatus.UNPAID;
        this.status = OrderStatus.PENDING;
        this.createdAt = Instant.now();
    }

    public Order(Integer id, String orderCode, String customer, Integer tableId, OrderType orderType) {
        this();
        this.id = id;
        this.orderCode = orderCode;
        this.customer = customer != null ? customer : "Walk-in";
        this.tableId = tableId;
        this.orderType = orderType != null ? orderType : OrderType.DINE_IN;
    }

    /**
     * Recalculates subtotal, VAT and total based on items and discount.
     */
    public void recalculateTotals() {
        this.subtotal = items.stream().mapToDouble(OrderItem::getLineTotal).sum();
        double afterDiscount = Math.max(0, this.subtotal - this.discountAmount);
        this.vatAmount = Math.round(afterDiscount * this.vatRate * 100.0) / 100.0;
        this.total = Math.round((afterDiscount + this.vatAmount + getShippingFee()) * 100.0) / 100.0;
    }

    public double getShippingFee() {
        return orderType == OrderType.DELIVERY ? DELIVERY_FEE : 0;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getOrderCode() {
        return orderCode;
    }

    public void setOrderCode(String orderCode) {
        this.orderCode = orderCode;
    }

    public String getCustomer() {
        return customer;
    }

    public void setCustomer(String customer) {
        this.customer = customer;
    }

    public Integer getTableId() {
        return tableId;
    }

    public void setTableId(Integer tableId) {
        this.tableId = tableId;
    }

    public OrderType getOrderType() {
        return orderType;
    }

    public void setOrderType(OrderType orderType) {
        this.orderType = orderType;
    }

    public List<OrderItem> getItems() {
        return Collections.unmodifiableList(items);
    }

    public void setItems(List<OrderItem> items) {
        this.items = items != null ? new ArrayList<>(items) : new ArrayList<>();
        recalculateTotals();
    }

    public void addItem(OrderItem item) {
        if (item != null) {
            this.items.add(item);
            recalculateTotals();
        }
    }

    public double getSubtotal() {
        return subtotal;
    }

    public void setSubtotal(double subtotal) {
        this.subtotal = subtotal;
    }

    public double getVatRate() {
        return vatRate;
    }

    public void setVatRate(double vatRate) {
        this.vatRate = vatRate;
        recalculateTotals();
    }

    public double getVatAmount() {
        return vatAmount;
    }

    public void setVatAmount(double vatAmount) {
        this.vatAmount = vatAmount;
    }

    public double getDiscountAmount() {
        return discountAmount;
    }

    public void setDiscountAmount(double discountAmount) {
        this.discountAmount = Math.max(0, discountAmount);
        recalculateTotals();
    }

    public double getTotal() {
        return total;
    }

    public void setTotal(double total) {
        this.total = total;
    }

    public PaymentMethod getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(PaymentMethod paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public PaymentStatus getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(PaymentStatus paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
        if (status == OrderStatus.COMPLETED && this.completedAt == null) {
            this.completedAt = Instant.now();
        }
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    /** Keyed on orderCode alone (unique in `orders.order_code`) so equals and hashCode agree; without one, only itself. */
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Order order = (Order) o;
        return orderCode != null && orderCode.equals(order.orderCode);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(orderCode);
    }

    @Override
    public String toString() {
        return "Order{" +
                "id=" + id +
                ", orderCode='" + orderCode + '\'' +
                ", customer='" + customer + '\'' +
                ", tableId=" + tableId +
                ", total=" + total +
                ", status=" + status +
                ", paymentStatus=" + paymentStatus +
                '}';
    }
}

