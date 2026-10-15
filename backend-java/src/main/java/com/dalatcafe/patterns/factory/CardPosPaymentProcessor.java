package com.dalatcafe.patterns.factory;

import java.util.UUID;

public class CardPosPaymentProcessor implements IPaymentProcessor {
    @Override
    public PaymentResult processPayment(double amount, String transactionRef) {
        validate(amount, transactionRef);
        return new PaymentResult(
                true,
                "CARD-" + UUID.randomUUID(),
                "Card POS payment completed for " + transactionRef);
    }

    @Override
    public String getMethodName() {
        return "Card POS";
    }

    private void validate(double amount, String transactionRef) {
        if (!Double.isFinite(amount) || amount <= 0) {
            throw new IllegalArgumentException("Payment amount must be greater than zero");
        }
        if (transactionRef == null || transactionRef.isBlank()) {
            throw new IllegalArgumentException("Transaction reference must not be blank");
        }
    }
}
