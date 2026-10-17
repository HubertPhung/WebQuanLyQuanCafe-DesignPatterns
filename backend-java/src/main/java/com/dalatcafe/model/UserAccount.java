package com.dalatcafe.model;

import java.time.Instant;
import java.util.Locale;
import java.util.Objects;

/**
 * A sign-in account. Password accounts store a PBKDF2 hash (never the password); Google
 * accounts store the stable Google subject id. One account may have both.
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

    /** Emails are compared case-insensitively, so they are stored in lower case. */
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

    /** A copy, so callers of the in-memory store cannot change stored accounts by accident. */
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
