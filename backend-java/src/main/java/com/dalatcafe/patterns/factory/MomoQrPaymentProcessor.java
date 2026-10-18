package com.dalatcafe.patterns.factory;

import java.util.UUID;

public class MomoQrPaymentProcessor implements IPaymentProcessor {
    @Override
    public PaymentResult processPayment(double amount, String transactionRef) {
        PaymentArguments.requireValid(amount, transactionRef);
        return new PaymentResult(
                true,
                "MOMO-" + UUID.randomUUID(),
                "MoMo QR payment completed for " + transactionRef);
    }

    @Override
    public String getMethodName() {
        return "MoMo QR";
    }
}
