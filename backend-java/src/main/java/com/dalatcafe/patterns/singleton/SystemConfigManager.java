package com.dalatcafe.patterns.singleton;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalTime;

/**
 * Singleton Pattern (GoF Creational) managing global operational parameters
 * for Đà Lạt Cafe (store info, operating hours, loyalty ratios, table reservation timeouts).
 *
 * Implements Thread-safe Double-Checked Locking with volatile instance and reflection protection.
 */
public final class SystemConfigManager implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    public static final String DEFAULT_STORE_NAME = "Đà Lạt Cafe";
    public static final String DEFAULT_STORE_ADDRESS = "Phường Cam Ly, TP. Đà Lạt, Lâm Đồng";
    public static final String DEFAULT_STORE_PHONE = "0263 382 2222";
    public static final double DEFAULT_VAT_RATE = 0.08;
    public static final int DEFAULT_LOYALTY_RATE_VND = 10000;
    public static final int DEFAULT_POINT_REDEEM_VND = 1000;
    public static final int DEFAULT_MAX_RESERVATION_GUESTS = 20;
    public static final int DEFAULT_AUTO_CANCEL_MINUTES = 30;
    public static final LocalTime DEFAULT_OPENING_TIME = LocalTime.of(7, 0);
    public static final LocalTime DEFAULT_CLOSING_TIME = LocalTime.of(22, 0);

    private static volatile SystemConfigManager instance;

    private String storeName;
    private String storeAddress;
    private String storePhone;
    private double vatRate;
    private int loyaltyRateVndPerPoint;
    private int pointRedeemValueVnd;
    private int maxReservationGuests;
    private int autoCancelMinutes;
    private LocalTime openingTime;
    private LocalTime closingTime;

    private SystemConfigManager() {
        if (instance != null) {
            throw new IllegalStateException("Instance đã tồn tại! Sử dụng getInstance().");
        }
        resetToDefaults();
    }

    /**
     * Provides the single, globally accessible instance of SystemConfigManager
     * using Double-Checked Locking.
     */
    public static SystemConfigManager getInstance() {
        if (instance == null) {
            synchronized (SystemConfigManager.class) {
                if (instance == null) {
                    instance = new SystemConfigManager();
                }
            }
        }
        return instance;
    }

    /**
     * Resets all parameters to factory defaults.
     */
    public void resetToDefaults() {
        this.storeName = DEFAULT_STORE_NAME;
        this.storeAddress = DEFAULT_STORE_ADDRESS;
        this.storePhone = DEFAULT_STORE_PHONE;
        this.vatRate = DEFAULT_VAT_RATE;
        this.loyaltyRateVndPerPoint = DEFAULT_LOYALTY_RATE_VND;
        this.pointRedeemValueVnd = DEFAULT_POINT_REDEEM_VND;
        this.maxReservationGuests = DEFAULT_MAX_RESERVATION_GUESTS;
        this.autoCancelMinutes = DEFAULT_AUTO_CANCEL_MINUTES;
        this.openingTime = DEFAULT_OPENING_TIME;
        this.closingTime = DEFAULT_CLOSING_TIME;
    }

    /**
     * Checks if a given time falls within cafe operating hours (07:00 - 22:00 by default).
     */
    public boolean isWithinOperatingHours(LocalTime time) {
        if (time == null) {
            time = LocalTime.now();
        }
        return !time.isBefore(openingTime) && !time.isAfter(closingTime);
    }

    /**
     * Calculates earned loyalty points based on total spend amount (10,000 VND = 1 point).
     */
    public int calculateLoyaltyPoints(double orderAmount) {
        if (orderAmount <= 0 || loyaltyRateVndPerPoint <= 0) {
            return 0;
        }
        return (int) (orderAmount / loyaltyRateVndPerPoint);
    }

    /**
     * Calculates discount amount when redeeming loyalty points (1 point = 1,000 VND).
     */
    public double calculateDiscountFromPoints(int points) {
        if (points <= 0) {
            return 0.0;
        }
        return (double) points * pointRedeemValueVnd;
    }

    @Serial
    private Object readResolve() {
        return getInstance();
    }

    // Getters and Setters

    public String getStoreName() {
        return storeName;
    }

    public void setStoreName(String storeName) {
        this.storeName = storeName;
    }

    public String getStoreAddress() {
        return storeAddress;
    }

    public void setStoreAddress(String storeAddress) {
        this.storeAddress = storeAddress;
    }

    public String getStorePhone() {
        return storePhone;
    }

    public void setStorePhone(String storePhone) {
        this.storePhone = storePhone;
    }

    public double getVatRate() {
        return vatRate;
    }

    public void setVatRate(double vatRate) {
        this.vatRate = vatRate;
    }

    public int getLoyaltyRateVndPerPoint() {
        return loyaltyRateVndPerPoint;
    }

    public void setLoyaltyRateVndPerPoint(int loyaltyRateVndPerPoint) {
        this.loyaltyRateVndPerPoint = Math.max(1, loyaltyRateVndPerPoint);
    }

    public int getPointRedeemValueVnd() {
        return pointRedeemValueVnd;
    }

    public void setPointRedeemValueVnd(int pointRedeemValueVnd) {
        this.pointRedeemValueVnd = Math.max(0, pointRedeemValueVnd);
    }

    public int getMaxReservationGuests() {
        return maxReservationGuests;
    }

    public void setMaxReservationGuests(int maxReservationGuests) {
        this.maxReservationGuests = Math.max(1, maxReservationGuests);
    }

    public int getAutoCancelMinutes() {
        return autoCancelMinutes;
    }

    public void setAutoCancelMinutes(int autoCancelMinutes) {
        this.autoCancelMinutes = Math.max(1, autoCancelMinutes);
    }

    public LocalTime getOpeningTime() {
        return openingTime;
    }

    public void setOpeningTime(LocalTime openingTime) {
        this.openingTime = openingTime != null ? openingTime : DEFAULT_OPENING_TIME;
    }

    public LocalTime getClosingTime() {
        return closingTime;
    }

    public void setClosingTime(LocalTime closingTime) {
        this.closingTime = closingTime != null ? closingTime : DEFAULT_CLOSING_TIME;
    }
}
