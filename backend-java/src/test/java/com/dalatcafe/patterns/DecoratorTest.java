package com.dalatcafe.patterns;

import com.dalatcafe.model.MenuItem;
import com.dalatcafe.patterns.decorator.BaseCoffee;
import com.dalatcafe.patterns.decorator.CheeseFoamDecorator;
import com.dalatcafe.patterns.decorator.IBeverage;
import com.dalatcafe.patterns.decorator.LargeSizeDecorator;
import com.dalatcafe.patterns.decorator.PearlToppingDecorator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DecoratorTest {
    @Test
    void stacksDescriptionAndCost() {
        MenuItem menuItem = new MenuItem(1, "Salted Cream Coffee", "Coffee", 55_000, 20_000, 100);
        IBeverage beverage = new PearlToppingDecorator(
                new CheeseFoamDecorator(
                        new LargeSizeDecorator(new BaseCoffee(menuItem))));

        assertEquals("Salted Cream Coffee (Size L) + Salted Cheese Foam + White Pearls",
                beverage.getDescription());
        assertEquals(90_000, beverage.getCost());
    }
}
