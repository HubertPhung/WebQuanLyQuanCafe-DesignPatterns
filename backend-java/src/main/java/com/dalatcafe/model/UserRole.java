package com.dalatcafe.model;

/**
 * Account roles, lowest to highest. A role includes every permission of the roles before it,
 * so {@code MANAGER.atLeast(STAFF)} is true.
 */
public enum UserRole {
    CUSTOMER("Khách hàng"),
    STAFF("Nhân viên"),
    MANAGER("Quản lý"),
    ADMIN("Quản trị viên");

    private final String description;

    UserRole(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }

    public boolean atLeast(UserRole other) {
        return compareTo(other) >= 0;
    }
}
