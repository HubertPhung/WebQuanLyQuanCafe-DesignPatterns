package com.dalatcafe.patterns.factory;

import com.dalatcafe.model.PaymentMethod;

public final class PaymentProcessorFactory {
    private PaymentProcessorFactory() {
    }

    public static IPaymentProcessor createProcessor(PaymentMethod method) {
        if (method == null) {
            throw new IllegalArgumentException("Payment method must not be null");
        }

        return switch (method) {
            case CASH -> new CashPaymentProcessor();
            case QR -> new MomoQrPaymentProcessor();
            case CARD -> new CardPosPaymentProcessor();
        };
    }
}
