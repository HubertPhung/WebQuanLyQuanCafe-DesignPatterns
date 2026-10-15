package com.dalatcafe.patterns.decorator;

import java.util.Objects;

public abstract class BeverageDecorator implements IBeverage {
    protected final IBeverage beverage;

    protected BeverageDecorator(IBeverage beverage) {
        this.beverage = Objects.requireNonNull(beverage, "Beverage must not be null");
    }

    @Override
    public String getDescription() {
        return beverage.getDescription();
    }

    @Override
    public double getCost() {
        return beverage.getCost();
    }
}
