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
    void rejectsOrderWithoutItems() {
        OrderBuilder builder = new OrderBuilder().forCustomer("Walk-in");

        assertThrows(IllegalStateException.class, builder::build);
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
        return new MenuItem(1, "Salted Cream Coffee", "Coffee", 55_000, 20_000, 100);
    }
}
