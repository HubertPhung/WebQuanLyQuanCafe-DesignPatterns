package com.dalatcafe.patterns;

import com.dalatcafe.model.Customer;
import com.dalatcafe.model.CustomerRank;
import com.dalatcafe.patterns.strategy.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class StrategyTest {
    @Test
    void computesDiscountsAndSwapsAtRuntime() {
        DiscountContext context = new DiscountContext();
        assertEquals(0, context.executeDiscount(100_000, null));
        context.setStrategy(new PercentageDiscountStrategy(.1, 5_000));
        assertEquals(5_000, context.executeDiscount(100_000, null));
        assertEquals(100, context.executeDiscount(1_000, null));
        context.setStrategy(new FixedAmountDiscountStrategy(30_000));
        assertEquals(30_000, context.executeDiscount(100_000, null));
        assertEquals(1_000, context.executeDiscount(1_000, null));
        assertFalse(context.getDiscountDescription().isBlank());
    }

    @ParameterizedTest
    @EnumSource(CustomerRank.class)
    void usesMembershipRank(CustomerRank rank) {
        Customer customer = new Customer();
        customer.setRank(rank);
        assertEquals(100_000 * rank.getDiscountRate(),
                new LoyaltyTierDiscountStrategy().calculateDiscount(100_000, customer));
    }

    @Test
    void missingMembershipGetsNoDiscount() {
        Customer customer = new Customer();
        customer.setRank(null);
        assertEquals(0, new LoyaltyTierDiscountStrategy().calculateDiscount(100, customer));
        assertEquals(0, new LoyaltyTierDiscountStrategy().calculateDiscount(100, null));
    }

    @ParameterizedTest
    @ValueSource(doubles = {-1, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY})
    void rejectsInvalidMoney(double value) {
        for (IDiscountStrategy strategy : strategies()) {
            assertThrows(IllegalArgumentException.class, () -> strategy.calculateDiscount(value, null));
        }
        assertThrows(IllegalArgumentException.class, () -> new DiscountContext().executeDiscount(value, null));
        assertThrows(IllegalArgumentException.class, () -> new FixedAmountDiscountStrategy(value));
        assertThrows(IllegalArgumentException.class, () -> new PercentageDiscountStrategy(.1, value));
        assertThrows(IllegalArgumentException.class, () -> new PercentageDiscountStrategy(value, 100));
    }

    @Test
    void handlesZeroAndExtremeSubtotals() {
        for (IDiscountStrategy strategy : strategies()) {
            assertEquals(0, strategy.calculateDiscount(0, null));
            double discount = strategy.calculateDiscount(Double.MAX_VALUE, null);
            assertTrue(Double.isFinite(discount));
            assertTrue(discount >= 0 && discount <= Double.MAX_VALUE);
            assertFalse(strategy.getDiscountDescription().isBlank());
        }
        assertEquals(100, new PercentageDiscountStrategy(1, 100).calculateDiscount(100, null));
        assertEquals(0, new PercentageDiscountStrategy(0, 0).calculateDiscount(100, null));
        assertThrows(IllegalArgumentException.class, () -> new PercentageDiscountStrategy(1.1, 100));
    }

    @Test
    void contextDefendsAgainstInvalidCustomStrategies() {
        assertThrows(NullPointerException.class, () -> new DiscountContext(null));
        assertThrows(NullPointerException.class, () -> new DiscountContext().setStrategy(null));
        for (double result : new double[]{-1, Double.NaN, Double.POSITIVE_INFINITY}) {
            assertThrows(IllegalArgumentException.class,
                    () -> new DiscountContext(custom(result)).executeDiscount(100, null));
        }
        assertEquals(100, new DiscountContext(custom(200)).executeDiscount(100, null));
    }

    private static IDiscountStrategy custom(double result) {
        return new IDiscountStrategy() {
            public double calculateDiscount(double subtotal, Customer customer) { return result; }
            public String getDiscountDescription() { return "Custom"; }
        };
    }

    private static List<IDiscountStrategy> strategies() {
        return List.of(new PercentageDiscountStrategy(.1, 50_000),
                new FixedAmountDiscountStrategy(30_000),
                new LoyaltyTierDiscountStrategy(), new NoDiscountStrategy());
    }
}
