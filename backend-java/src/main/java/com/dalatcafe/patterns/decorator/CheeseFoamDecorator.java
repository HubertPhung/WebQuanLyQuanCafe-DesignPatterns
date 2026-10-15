package com.dalatcafe.patterns.decorator;

public class CheeseFoamDecorator extends BeverageDecorator {
    private static final double PRICE = 15_000;

    public CheeseFoamDecorator(IBeverage beverage) {
        super(beverage);
    }

    @Override
    public String getDescription() {
        return beverage.getDescription() + " + Salted Cheese Foam";
    }

    @Override
    public double getCost() {
        return beverage.getCost() + PRICE;
    }
}
