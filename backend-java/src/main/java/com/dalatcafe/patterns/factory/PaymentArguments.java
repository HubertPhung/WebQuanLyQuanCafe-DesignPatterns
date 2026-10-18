package com.dalatcafe.patterns.factory;

/** The checks every payment channel applies before it takes money. */
final class PaymentArguments {
    private PaymentArguments() {
    }

    static void requireValid(double amount, String transactionRef) {
        if (!Double.isFinite(amount) || amount <= 0) {
            throw new IllegalArgumentException("Payment amount must be greater than zero");
        }
        if (transactionRef == null || transactionRef.isBlank()) {
            throw new IllegalArgumentException("Transaction reference must not be blank");
        }
    }
}
