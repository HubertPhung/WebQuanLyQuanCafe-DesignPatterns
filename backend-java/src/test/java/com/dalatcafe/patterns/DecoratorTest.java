package com.dalatcafe.patterns;

import com.dalatcafe.model.MenuItem;
import com.dalatcafe.patterns.decorator.BaseCoffee;
import com.dalatcafe.patterns.decorator.CheeseFoamDecorator;
import com.dalatcafe.patterns.decorator.IBeverage;
import com.dalatcafe.patterns.decorator.LargeSizeDecorator;
import com.dalatcafe.patterns.decorator.PearlToppingDecorator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DecoratorTest {
    @Test
    void stacksDescriptionAndCost() {
        IBeverage beverage = new PearlToppingDecorator(
                new CheeseFoamDecorator(
                        new LargeSizeDecorator(new BaseCoffee(menuItem()))));

        assertEquals("Salted Cream Coffee (Size L) + Salted Cheese Foam + White Pearls",
                beverage.getDescription());
        assertEquals(90_000, beverage.getCost());
    }

    @Test
    void baseCoffeeUsesMenuSellPrice() {
        IBeverage beverage = new BaseCoffee(menuItem());

        assertEquals("Salted Cream Coffee", beverage.getDescription());
        assertEquals(55_000, beverage.getCost());
    }

    @Test
    void eachDecoratorAddsItsOwnSurcharge() {
        IBeverage base = new BaseCoffee(menuItem());

        assertEquals(65_000, new LargeSizeDecorator(base).getCost());
        assertEquals(70_000, new CheeseFoamDecorator(base).getCost());
        assertEquals(65_000, new PearlToppingDecorator(base).getCost());
    }

    @Test
    void sameToppingCanBeStackedTwice() {
        IBeverage beverage = new PearlToppingDecorator(new PearlToppingDecorator(new BaseCoffee(menuItem())));

        assertEquals("Salted Cream Coffee + White Pearls + White Pearls", beverage.getDescription());
        assertEquals(75_000, beverage.getCost());
    }

    @Test
    void totalCostDoesNotDependOnWrappingOrder() {
        IBeverage foamFirst = new LargeSizeDecorator(new CheeseFoamDecorator(new BaseCoffee(menuItem())));
        IBeverage sizeFirst = new CheeseFoamDecorator(new LargeSizeDecorator(new BaseCoffee(menuItem())));

        assertEquals(foamFirst.getCost(), sizeFirst.getCost());
    }

    @Test
    void decoratingDoesNotChangeWrappedBeverage() {
        IBeverage base = new BaseCoffee(menuItem());
        new LargeSizeDecorator(base);

        assertEquals("Salted Cream Coffee", base.getDescription());
        assertEquals(55_000, base.getCost());
    }

    @Test
    void rejectsNullMenuItem() {
        assertThrows(NullPointerException.class, () -> new BaseCoffee(null));
    }

    @Test
    void rejectsNullWrappedBeverage() {
        assertThrows(NullPointerException.class, () -> new LargeSizeDecorator(null));
        assertThrows(NullPointerException.class, () -> new CheeseFoamDecorator(null));
        assertThrows(NullPointerException.class, () -> new PearlToppingDecorator(null));
    }

    private MenuItem menuItem() {
        return new MenuItem(1, "Salted Cream Coffee", "Coffee", 55_000, 20_000, 100);
    }
}
