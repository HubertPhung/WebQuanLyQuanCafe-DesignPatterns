package com.dalatcafe.patterns.facade;

import com.dalatcafe.model.Customer;
import com.dalatcafe.model.OrderType;
import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.patterns.strategy.IDiscountStrategy;

import java.util.List;
import java.util.Objects;

/**
 * Immutable input of {@link PosCheckoutFacade#checkout(CheckoutRequest)}.
 * {@code customer} and {@code discountStrategy} are optional.
 */
public final class CheckoutRequest {
    private final List<CheckoutLine> lines;
    private final Integer tableId;
    private final OrderType orderType;
    private final PaymentMethod paymentMethod;
    private final Customer customer;
    private final IDiscountStrategy discountStrategy;
    private final String note;

    public CheckoutRequest(List<CheckoutLine> lines, Integer tableId, OrderType orderType,
                           PaymentMethod paymentMethod, Customer customer,
                           IDiscountStrategy discountStrategy, String note) {
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
}
