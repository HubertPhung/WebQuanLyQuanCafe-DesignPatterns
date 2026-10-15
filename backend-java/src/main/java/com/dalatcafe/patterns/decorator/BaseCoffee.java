package com.dalatcafe.patterns.decorator;

import com.dalatcafe.model.MenuItem;

import java.util.Objects;

public class BaseCoffee implements IBeverage {
    private final MenuItem menuItem;

    public BaseCoffee(MenuItem menuItem) {
        this.menuItem = Objects.requireNonNull(menuItem, "Menu item must not be null");
    }

    @Override
    public String getDescription() {
        return menuItem.getName();
    }

    @Override
    public double getCost() {
        return menuItem.getSellPrice();
    }
}
