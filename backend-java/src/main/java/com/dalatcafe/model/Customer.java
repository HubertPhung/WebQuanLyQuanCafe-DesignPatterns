package com.dalatcafe.model;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/**
 * Thực thể hồ sơ khách hàng, quản lý điểm tích lũy CRM và hạng thành viên.
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
     * Cập nhật hạng khách hàng theo tổng chi tiêu. Đồng: < 500k, Bạc: 500k - 2tr, Vàng: 2tr - 5tr,
     * Kim cương (VIP): > 5tr
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

    /**
     * Hoàn lại số điểm đã đổi trước đó; khác với {@link #addOrderRecord}, hàm này không tính thêm
     * lượt ghé.
     */
    public boolean restorePoints(int points) {
        if (points > 0) {
            this.loyaltyPoints += points;
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

    /**
     * So sánh chỉ theo số điện thoại (duy nhất trong `customers.phone`) để equals và hashCode khớp
     * nhau; nếu không có số thì chỉ bằng chính nó.
     */
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Customer customer = (Customer) o;
        return phone != null && phone.equals(customer.phone);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(phone);
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

