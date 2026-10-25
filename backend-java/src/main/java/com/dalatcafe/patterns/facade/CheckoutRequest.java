package com.dalatcafe.patterns.facade;

import com.dalatcafe.model.Branches;
import com.dalatcafe.model.Customer;
import com.dalatcafe.model.OrderType;
import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.patterns.strategy.IDiscountStrategy;

import java.util.List;
import java.util.Objects;

/**
 * Đầu vào bất biến của {@link PosCheckoutFacade#checkout(CheckoutRequest)}. {@code customer},
 * {@code discountStrategy}, {@code tenderedAmount} và {@code branch} là tùy chọn; không có chi
 * nhánh thì đơn thuộc {@link Branches#DEFAULT}.
 */
public final class CheckoutRequest {
    private final List<CheckoutLine> lines;
    private final Integer tableId;
    private final OrderType orderType;
    private final PaymentMethod paymentMethod;
    private final Customer customer;
    private final IDiscountStrategy discountStrategy;
    private final String note;
    private final Double tenderedAmount;
    private final String branch;

    public CheckoutRequest(List<CheckoutLine> lines, Integer tableId, OrderType orderType,
                           PaymentMethod paymentMethod, Customer customer,
                           IDiscountStrategy discountStrategy, String note) {
        this(lines, tableId, orderType, paymentMethod, customer, discountStrategy, note, null);
    }

    /** {@code tenderedAmount} là tiền mặt khách đưa; đơn trả tiền mặt phải đủ tổng tiền. */
    public CheckoutRequest(List<CheckoutLine> lines, Integer tableId, OrderType orderType,
                           PaymentMethod paymentMethod, Customer customer,
                           IDiscountStrategy discountStrategy, String note, Double tenderedAmount) {
        this(lines, tableId, orderType, paymentMethod, customer, discountStrategy, note, tenderedAmount, null);
    }

    public CheckoutRequest(List<CheckoutLine> lines, Integer tableId, OrderType orderType,
                           PaymentMethod paymentMethod, Customer customer,
                           IDiscountStrategy discountStrategy, String note, Double tenderedAmount, String branch) {
        Objects.requireNonNull(lines, "Lines must not be null");
        if (lines.isEmpty()) {
            throw new IllegalArgumentException("Checkout must contain at least one line");
        }
        this.lines = List.copyOf(lines);
        this.tableId = tableId;
        this.orderType = orderType == null ? OrderType.DINE_IN : orderType;
        this.paymentMethod = Objects.requireNonNull(paymentMethod, "Payment method must not be null");
        this.customer = customer;
        this.discountStrategy = discountStrategy;
        this.note = note;
        if (tenderedAmount != null && tenderedAmount < 0) {
            throw new IllegalArgumentException("Tendered amount must not be negative");
        }
        this.tenderedAmount = tenderedAmount;
        this.branch = Branches.orDefault(branch);
    }

    public List<CheckoutLine> getLines() {
        return lines;
    }

    public Integer getTableId() {
        return tableId;
    }

    public OrderType getOrderType() {
        return orderType;
    }

    public PaymentMethod getPaymentMethod() {
        return paymentMethod;
    }

    public Customer getCustomer() {
        return customer;
    }

    public IDiscountStrategy getDiscountStrategy() {
        return discountStrategy;
    }

    public String getNote() {
        return note;
    }

    public Double getTenderedAmount() {
        return tenderedAmount;
    }

    public String getBranch() {
        return branch;
    }
}
