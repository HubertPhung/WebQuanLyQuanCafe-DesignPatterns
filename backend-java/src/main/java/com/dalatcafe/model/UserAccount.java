package com.dalatcafe.model;

import java.time.Instant;
import java.util.Locale;
import java.util.Objects;

/**
 * Một tài khoản đăng nhập. Tài khoản mật khẩu lưu hash PBKDF2 (không bao giờ lưu mật khẩu); tài
 * khoản Google lưu Google subject id cố định. Một tài khoản có thể có cả hai.
 */
public class UserAccount {
    private Integer id;
    private String email;
    private String name;
    private String passwordHash;
    private String googleSubject;
    private UserRole role;
    private boolean active;
    private Instant createdAt;
    private Instant lastLoginAt;

    public UserAccount() {
        this.role = UserRole.CUSTOMER;
        this.active = true;
        this.createdAt = Instant.now();
    }

    public UserAccount(Integer id, String email, String name, UserRole role) {
        this();
        this.id = id;
        setEmail(email);
        this.name = name;
        this.role = Objects.requireNonNull(role, "Role must not be null");
    }

    /** Email được so sánh không phân biệt hoa thường, nên được lưu dạng chữ thường. */
    public static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = normalizeEmail(email);
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getGoogleSubject() {
        return googleSubject;
    }

    public void setGoogleSubject(String googleSubject) {
        this.googleSubject = googleSubject;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = Objects.requireNonNull(role, "Role must not be null");
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(Instant lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }

    /** Một bản sao, để nơi gọi kho trong bộ nhớ không vô tình sửa tài khoản đã lưu. */
    public UserAccount copy() {
        UserAccount copy = new UserAccount();
        copy.id = id;
        copy.email = email;
        copy.name = name;
        copy.passwordHash = passwordHash;
        copy.googleSubject = googleSubject;
        copy.role = role;
        copy.active = active;
        copy.createdAt = createdAt;
        copy.lastLoginAt = lastLoginAt;
        return copy;
    }
}
