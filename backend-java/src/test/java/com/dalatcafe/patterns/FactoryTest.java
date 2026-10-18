package com.dalatcafe.patterns;

import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.patterns.factory.CardPosPaymentProcessor;
import com.dalatcafe.patterns.factory.CashPaymentProcessor;
import com.dalatcafe.patterns.factory.IPaymentProcessor;
import com.dalatcafe.patterns.factory.MomoQrPaymentProcessor;
import com.dalatcafe.patterns.factory.PaymentProcessorFactory;
import com.dalatcafe.patterns.factory.PaymentResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FactoryTest {
    @ParameterizedTest
    @MethodSource("paymentProcessors")
    void createsProcessorForPaymentMethod(PaymentMethod method, Class<?> expectedType) {
        assertInstanceOf(expectedType, PaymentProcessorFactory.createProcessor(method));
    }

    @Test
    void rejectsMissingPaymentMethod() {
        assertThrows(IllegalArgumentException.class, () -> PaymentProcessorFactory.createProcessor(null));
    }

    @Test
    void processorReturnsSuccessfulPaymentResult() {
        IPaymentProcessor processor = PaymentProcessorFactory.createProcessor(PaymentMethod.QR);

        PaymentResult result = processor.processPayment(75_000, "ORDER-001");

        assertTrue(result.isSuccess());
        assertTrue(result.getTransactionId().startsWith("MOMO-"));
    }

    @ParameterizedTest
    @EnumSource(PaymentMethod.class)
    void everyProcessorRefusesAnInvalidAmountOrReference(PaymentMethod method) {
        IPaymentProcessor processor = PaymentProcessorFactory.createProcessor(method);

        for (double amount : new double[] {0, -1, Double.NaN, Double.POSITIVE_INFINITY}) {
            assertThrows(IllegalArgumentException.class, () -> processor.processPayment(amount, "ORDER-001"));
        }
        assertThrows(IllegalArgumentException.class, () -> processor.processPayment(75_000, null));
        assertThrows(IllegalArgumentException.class, () -> processor.processPayment(75_000, "  "));
    }

    private static Stream<Arguments> paymentProcessors() {
        return Stream.of(
                Arguments.of(PaymentMethod.CASH, CashPaymentProcessor.class),
                Arguments.of(PaymentMethod.QR, MomoQrPaymentProcessor.class),
                Arguments.of(PaymentMethod.CARD, CardPosPaymentProcessor.class));
    }
}
