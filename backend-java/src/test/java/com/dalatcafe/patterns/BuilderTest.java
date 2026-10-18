package com.dalatcafe.patterns;

import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderType;
import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.patterns.builder.OrderBuilder;
import com.dalatcafe.patterns.decorator.BaseCoffee;
import com.dalatcafe.patterns.decorator.IBeverage;
import com.dalatcafe.patterns.decorator.LargeSizeDecorator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BuilderTest {
    @Test
    void buildsFluentOrderAndCalculatesTotals() {
        IBeverage beverage = new LargeSizeDecorator(new BaseCoffee(menuItem()));

        Order order = new OrderBuilder()
                .forCustomer("Nguyen Hung Thinh")
                .atTable(8)
                .ofType(OrderType.DINE_IN)
                .addItem(beverage, 2)
                .withNote("Less ice")
                .withPayment(PaymentMethod.CARD, true)
                .applyDiscount(10_000)
                .build();

        assertTrue(order.getOrderCode().matches("AC-[A-F0-9]{4}-[A-F0-9]{3}"));
        assertEquals("Nguyen Hung Thinh", order.getCustomer());
        assertEquals(8, order.getTableId());
        assertEquals(130_000, order.getSubtotal());
        assertEquals(10_000, order.getDiscountAmount());
        assertEquals(9_600, order.getVatAmount());
        assertEquals(129_600, order.getTotal());
        assertEquals(PaymentMethod.CARD, order.getPaymentMethod());
        assertEquals(PaymentStatus.PAID, order.getPaymentStatus());
    }

    @Test
    void appliesWalkInDefaultsWhenOptionalStepsAreSkipped() {
        Order order = new OrderBuilder()
                .forCustomer("   ")
                .addItem(new BaseCoffee(menuItem()), 1)
                .build();

        assertEquals("Walk-in", order.getCustomer());
        assertNull(order.getTableId());
        assertEquals(OrderType.DINE_IN, order.getOrderType());
        assertEquals(PaymentMethod.CASH, order.getPaymentMethod());
        assertEquals(PaymentStatus.UNPAID, order.getPaymentStatus());
        assertEquals(0, order.getDiscountAmount());
        assertEquals(4_400, order.getVatAmount());
        assertEquals(59_400, order.getTotal());
    }

    @Test
    void keepsTheMenuItemBehindEachDecoratedDrink() {
        Order order = new OrderBuilder()
                .addItem(7, new LargeSizeDecorator(new BaseCoffee(menuItem())), 2)
                .addItem(new BaseCoffee(menuItem()), 1)
                .build();

        assertEquals(7, order.getItems().get(0).getMenuItemId());
        assertEquals(2, order.getItems().get(0).getQty());
        assertNull(order.getItems().get(1).getMenuItemId(), "the original step still works without an id");
    }

    @Test
    void drawsAnotherCodeWhileTheStoreAlreadyHoldsIt() {
        java.util.List<String> drawn = new java.util.ArrayList<>();
        Order order = new OrderBuilder()
                .addItem(new BaseCoffee(menuItem()), 1)
                .avoidingCodes(code -> {
                    drawn.add(code);
                    return drawn.size() < 3;
                })
                .build();

        assertEquals(3, drawn.size());
        assertEquals(drawn.get(2), order.getOrderCode());
        assertTrue(order.getOrderCode().matches("AC-[A-F0-9]{4}-[A-F0-9]{3}"));

        OrderBuilder full = new OrderBuilder().addItem(new BaseCoffee(menuItem()), 1).avoidingCodes(code -> true);
        assertThrows(IllegalStateException.class, full::build);
        assertThrows(NullPointerException.class, () -> new OrderBuilder().avoidingCodes(null));
    }

    @Test
    void rejectsOrderWithoutItems() {
        OrderBuilder builder = new OrderBuilder().forCustomer("Walk-in");

        assertThrows(IllegalStateException.class, builder::build);
    }

    @Test
    void rejectsInvalidStepArguments() {
        OrderBuilder builder = new OrderBuilder();
        IBeverage beverage = new BaseCoffee(menuItem());

        assertThrows(IllegalArgumentException.class, () -> builder.atTable(0));
        assertThrows(IllegalArgumentException.class, () -> builder.addItem(beverage, 0));
        assertThrows(IllegalArgumentException.class, () -> builder.applyDiscount(-1));
        assertThrows(IllegalArgumentException.class, () -> builder.applyDiscount(Double.NaN));
        assertThrows(NullPointerException.class, () -> builder.addItem(null, 1));
        assertThrows(NullPointerException.class, () -> builder.ofType(null));
        assertThrows(NullPointerException.class, () -> builder.withPayment(null, true));
    }

    @Test
    void previouslyBuiltOrderIsNotChangedWhenBuilderIsReused() {
        IBeverage beverage = new BaseCoffee(menuItem());
        OrderBuilder builder = new OrderBuilder().addItem(beverage, 1);

        Order firstOrder = builder.build();
        builder.addItem(beverage, 1);
        Order secondOrder = builder.build();

        assertEquals(1, firstOrder.getItems().size());
        assertEquals(2, secondOrder.getItems().size());
        assertNotEquals(firstOrder.getOrderCode(), secondOrder.getOrderCode());
    }

    private MenuItem menuItem() {
        return new MenuItem(1, "Salted Cream Coffee", "Coffee", 55_000, 20_000);
    }
}
