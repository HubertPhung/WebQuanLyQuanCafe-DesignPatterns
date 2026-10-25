package com.dalatcafe.model;

import java.io.Serializable;
import java.util.Objects;

/**
 * Một dòng món trong Order hoặc trong danh sách món đặt trước của Reservation.
 */
public class OrderItem implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer menuItemId;
    private String name;
    private int qty;
    private double price;
    private String variation;
    private String notes;

    public OrderItem() {
    }

    public OrderItem(String name, int qty, double price) {
        this(null, name, qty, price, null, null);
    }

    public OrderItem(String name, int qty, double price, String variation) {
        this(null, name, qty, price, variation, null);
    }

    public OrderItem(Integer menuItemId, String name, int qty, double price, String variation, String notes) {
        this.menuItemId = menuItemId;
        this.name = name;
        this.qty = Math.max(qty, 1);
        this.price = price;
        this.variation = variation;
        this.notes = notes;
    }

    public double getLineTotal() {
        return price * qty;
    }

    public Integer getMenuItemId() {
        return menuItemId;
    }

    public void setMenuItemId(Integer menuItemId) {
        this.menuItemId = menuItemId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getQty() {
        return qty;
    }

    public void setQty(int qty) {
        this.qty = Math.max(qty, 1);
    }

    public double getPrice() {
        return price;
    }

    public void setPrice(double price) {
        this.price = price;
    }

    public String getVariation() {
        return variation;
    }

    public void setVariation(String variation) {
        this.variation = variation;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        OrderItem orderItem = (OrderItem) o;
        return qty == orderItem.qty &&
                Double.compare(orderItem.price, price) == 0 &&
                Objects.equals(menuItemId, orderItem.menuItemId) &&
                Objects.equals(name, orderItem.name) &&
                Objects.equals(variation, orderItem.variation);
    }

    @Override
    public int hashCode() {
        return Objects.hash(menuItemId, name, qty, price, variation);
    }

    @Override
    public String toString() {
        return "OrderItem{" +
                "name='" + name + '\'' +
                ", qty=" + qty +
                ", price=" + price +
                (variation != null ? ", variation='" + variation + '\'' : "") +
                ", lineTotal=" + getLineTotal() +
                '}';
    }
}

