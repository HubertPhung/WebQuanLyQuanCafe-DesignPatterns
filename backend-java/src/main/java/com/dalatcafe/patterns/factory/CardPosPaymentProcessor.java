package com.dalatcafe.patterns.factory;

import java.util.UUID;

public class CardPosPaymentProcessor implements IPaymentProcessor {
    @Override
    public PaymentResult processPayment(double amount, String transactionRef) {
        PaymentArguments.requireValid(amount, transactionRef);
        return new PaymentResult(
                true,
                "CARD-" + UUID.randomUUID(),
                "Card POS payment completed for " + transactionRef);
    }

    @Override
    public String getMethodName() {
        return "Card POS";
    }
}
