package com.dalatcafe.patterns.factory;

import java.util.UUID;

public class CashPaymentProcessor implements IPaymentProcessor {
    @Override
    public PaymentResult processPayment(double amount, String transactionRef) {
        PaymentArguments.requireValid(amount, transactionRef);
        return new PaymentResult(
                true,
                "CASH-" + UUID.randomUUID(),
                "Cash payment completed for " + transactionRef);
    }

    @Override
    public String getMethodName() {
        return "Cash";
    }
}
