package com.dalatcafe.patterns.decorator;

public class PearlToppingDecorator extends BeverageDecorator {
    private static final double PRICE = 10_000;

    public PearlToppingDecorator(IBeverage beverage) {
        super(beverage);
    }

    @Override
    public String getDescription() {
        return beverage.getDescription() + " + White Pearls";
    }

    @Override
    public double getCost() {
        return beverage.getCost() + PRICE;
    }
}
