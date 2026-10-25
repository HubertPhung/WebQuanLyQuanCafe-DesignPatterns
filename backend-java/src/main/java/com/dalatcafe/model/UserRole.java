package com.dalatcafe.model;

/**
 * Vai trò tài khoản, từ thấp tới cao. Mỗi vai trò có mọi quyền của các vai trò đứng trước nó, nên
 * {@code MANAGER.atLeast(STAFF)} là true.
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
