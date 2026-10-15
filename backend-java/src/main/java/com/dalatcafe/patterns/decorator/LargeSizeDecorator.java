package com.dalatcafe.patterns.decorator;

public class LargeSizeDecorator extends BeverageDecorator {
    private static final double PRICE = 10_000;

    public LargeSizeDecorator(IBeverage beverage) {
        super(beverage);
    }

    @Override
    public String getDescription() {
        return beverage.getDescription() + " (Size L)";
    }

    @Override
    public double getCost() {
        return beverage.getCost() + PRICE;
    }
}
