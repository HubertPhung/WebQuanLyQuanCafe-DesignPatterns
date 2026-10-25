package com.dalatcafe.patterns.facade;

import com.dalatcafe.model.Order;
import com.dalatcafe.patterns.factory.PaymentResult;

import java.util.List;

/**
 * Kết quả của một lần checkout. Khi thất bại, {@code order} là null và không có gì được lưu; {@code
 * warnings} liệt kê các lỗi không nghiêm trọng xảy ra sau khi lưu, ví dụ một observer lỗi sau khi
 * đơn đã được lưu.
 */
public final class CheckoutResult {
    private final boolean success;
    private final Order order;
    private final PaymentResult paymentResult;
    private final String message;
    private final FailureType failureType;
    private final List<String> warnings;

    /** Lý do checkout thất bại; null khi thành công. */
    public enum FailureType { NOT_FOUND, OUT_OF_STOCK, PAYMENT_FAILED, PERSISTENCE_FAILED }

    private CheckoutResult(boolean success, Order order, PaymentResult paymentResult,
                           String message, FailureType failureType, List<String> warnings) {
        this.failureType = failureType;
        this.success = success;
        this.order = order;
        this.paymentResult = paymentResult;
        this.message = message;
        this.warnings = List.copyOf(warnings);
    }

    static CheckoutResult success(Order order, PaymentResult payment, List<String> warnings) {
        return new CheckoutResult(true, order, payment, "Checkout completed", null, warnings);
    }

    static CheckoutResult failure(FailureType type, String message, PaymentResult payment) {
        return new CheckoutResult(false, null, payment, message, type, List.of());
    }

    public boolean isSuccess() {
        return success;
    }

    public Order getOrder() {
        return order;
    }

    public PaymentResult getPaymentResult() {
        return paymentResult;
    }

    public FailureType getFailureType() {
        return failureType;
    }

    public String getMessage() {
        return message;
    }

    public List<String> getWarnings() {
        return warnings;
    }
}
