package com.dalatcafe.model;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/**
 * Customer profile entity managing CRM loyalty points and membership rank.
 */
public class Customer implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer id;
    private String name;
    private String phone;
    private String email;
    private int totalOrders;
    private double totalSpent;
    private int loyaltyPoints;
    private CustomerRank rank;
    private Instant lastVisit;

    public Customer() {
        this.rank = CustomerRank.BRONZE;
        this.loyaltyPoints = 0;
        this.totalOrders = 0;
        this.totalSpent = 0.0;
        this.lastVisit = Instant.now();
    }

    public Customer(Integer id, String name, String phone, String email) {
        this();
        this.id = id;
        this.name = name;
        this.phone = phone;
        this.email = email;
    }

    /**
     * Updates customer rank based on lifetime spend.
     * Bronze: < 500k, Silver: 500k - 2tr, Gold: 2tr - 5tr, VIP: > 5tr
     */
    public void updateRank() {
        if (totalSpent >= 5000000) {
            this.rank = CustomerRank.VIP;
        } else if (totalSpent >= 2000000) {
            this.rank = CustomerRank.GOLD;
        } else if (totalSpent >= 500000) {
            this.rank = CustomerRank.SILVER;
        } else {
            this.rank = CustomerRank.BRONZE;
        }
    }

    public void addOrderRecord(double orderAmount, int earnedPoints) {
        this.totalOrders++;
        this.totalSpent += orderAmount;
        this.loyaltyPoints += earnedPoints;
        this.lastVisit = Instant.now();
        updateRank();
    }

    public boolean redeemPoints(int points) {
        if (points > 0 && this.loyaltyPoints >= points) {
            this.loyaltyPoints -= points;
            return true;
        }
        return false;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public int getTotalOrders() {
        return totalOrders;
    }

    public void setTotalOrders(int totalOrders) {
        this.totalOrders = totalOrders;
    }

    public double getTotalSpent() {
        return totalSpent;
    }

    public void setTotalSpent(double totalSpent) {
        this.totalSpent = totalSpent;
        updateRank();
    }

    public int getLoyaltyPoints() {
        return loyaltyPoints;
    }

    public void setLoyaltyPoints(int loyaltyPoints) {
        this.loyaltyPoints = Math.max(0, loyaltyPoints);
    }

    public CustomerRank getRank() {
        return rank;
    }

    public void setRank(CustomerRank rank) {
        this.rank = rank;
    }

    public Instant getLastVisit() {
        return lastVisit;
    }

    public void setLastVisit(Instant lastVisit) {
        this.lastVisit = lastVisit;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Customer customer = (Customer) o;
        return Objects.equals(id, customer.id) || Objects.equals(phone, customer.phone);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, phone);
    }

    @Override
    public String toString() {
        return "Customer{" +
                "id=" + id +
                ", name='" + name + '\'' +
                ", phone='" + phone + '\'' +
                ", rank=" + rank +
                ", points=" + loyaltyPoints +
                ", totalSpent=" + totalSpent +
                '}';
    }
}

