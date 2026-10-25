package com.dalatcafe.model;

import java.io.Serializable;
import java.util.Objects;

/**
 * Tùy chọn biến thể của một MenuItem (ví dụ Size L, Nóng, Đá, xay cho pha phin).
 */
public class Variation implements Serializable {
    private static final long serialVersionUID = 1L;

    private String name;
    private double price;

    public Variation() {
    }

    public Variation(String name, double price) {
        this.name = name;
        this.price = price;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public double getPrice() {
        return price;
    }

    public void setPrice(double price) {
        this.price = price;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Variation variation = (Variation) o;
        return Double.compare(variation.price, price) == 0 && Objects.equals(name, variation.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, price);
    }

    @Override
    public String toString() {
        return "Variation{" +
                "name='" + name + '\'' +
                ", price=" + price +
                '}';
    }
}

