package com.dalatcafe.patterns.factory;

public interface IPaymentProcessor {
    PaymentResult processPayment(double amount, String transactionRef);

    String getMethodName();
}
