package com.dalatcafe.patterns.singleton;

import com.dalatcafe.dao.IConfigDao;
import java.io.Serial;
import java.io.Serializable;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.logging.Level;
import java.util.logging.Logger;

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
    /** Phiếu chưa nhận bàn được giữ 30 phút tính từ giờ bắt đầu, rồi tự hủy. */
    public static final int DEFAULT_AUTO_CANCEL_MINUTES = 30;
    public static final LocalTime DEFAULT_OPENING_TIME = LocalTime.of(7, 0);
    public static final LocalTime DEFAULT_CLOSING_TIME = LocalTime.of(22, 0);
    private static final ZoneId CAFE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private static final Logger LOGGER = Logger.getLogger(SystemConfigManager.class.getName());

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

    /** Nơi lưu cài đặt; là null cho tới khi gọi {@link #attachStore} (khi đó không có gì được lưu). */
    private transient IConfigDao store;

    private SystemConfigManager() {
        if (instance != null) {
            throw new IllegalStateException("Instance đã tồn tại! Sử dụng getInstance().");
        }
        resetToDefaults();
    }

    /**
     * Trả về thể hiện duy nhất, dùng chung toàn hệ thống của SystemConfigManager,
     * khởi tạo theo kỹ thuật Double-Checked Locking.
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
     * Đưa mọi tham số về giá trị mặc định ban đầu.
     */
    public synchronized void resetToDefaults() {
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
     * Kiểm tra một thời điểm có nằm trong giờ mở cửa của quán không (mặc định 07:00 - 22:00).
     * Truyền null nghĩa là giờ hiện tại ở quán, bất kể máy chủ chạy theo múi giờ nào.
     */
    public synchronized boolean isWithinOperatingHours(LocalTime time) {
        if (time == null) {
            time = LocalTime.now(CAFE_ZONE);
        }
        return !time.isBefore(openingTime) && !time.isAfter(closingTime);
    }

    /**
     * Tính số điểm tích lũy nhận được theo tổng tiền chi tiêu (10.000 VNĐ = 1 điểm).
     */
    public synchronized int calculateLoyaltyPoints(double orderAmount) {
        if (orderAmount <= 0 || loyaltyRateVndPerPoint <= 0) {
            return 0;
        }
        return (int) (orderAmount / loyaltyRateVndPerPoint);
    }

    /**
     * Tính số tiền được giảm khi đổi điểm tích lũy (1 điểm = 1.000 VNĐ).
     */
    public synchronized double calculateDiscountFromPoints(int points) {
        if (points <= 0) {
            return 0.0;
        }
        return (double) points * pointRedeemValueVnd;
    }

    /**
     * Gắn nơi lưu trữ và nạp các cài đặt đã lưu từ đó, để giá trị vẫn còn sau khi khởi động lại.
     * Khóa bị thiếu hoặc không đọc được thì giữ nguyên giá trị hiện tại.
     */
    public synchronized void attachStore(IConfigDao store) {
        this.store = store;
        if (store == null) {
            return;
        }
        Map<String, String> saved = store.loadAll();
        applyString(saved, "storeName", v -> this.storeName = v);
        applyString(saved, "storeAddress", v -> this.storeAddress = v);
        applyString(saved, "storePhone", v -> this.storePhone = v);
        applyParsed(saved, "vatRate", Double::parseDouble, v -> this.vatRate = v);
        applyParsed(saved, "loyaltyRateVndPerPoint", Integer::parseInt, this::setLoyaltyRateVndPerPoint);
        applyParsed(saved, "pointRedeemValueVnd", Integer::parseInt, this::setPointRedeemValueVnd);
        applyParsed(saved, "maxReservationGuests", Integer::parseInt, this::setMaxReservationGuests);
        // autoCancelMinutes không đọc lại: API không sửa được nó, và giá trị 15 lưu từ trước quy tắc
        // giữ bàn 30 phút không được ghi đè mặc định mới.
        applyParsed(saved, "openingTime", LocalTime::parse, this::setOpeningTime);
        applyParsed(saved, "closingTime", LocalTime::parse, this::setClosingTime);
    }

    /**
     * Lưu toàn bộ cài đặt hiện tại trong một lần ghi. Trả về false khi chưa gắn nơi lưu trữ hoặc
     * ghi thất bại, để nơi gọi báo cho người dùng biết thay đổi chưa được lưu lâu dài.
     */
    public synchronized boolean persist() {
        if (store == null) {
            return false;
        }
        Map<String, String> values = new LinkedHashMap<>();
        values.put("storeName", storeName);
        values.put("storeAddress", storeAddress);
        values.put("storePhone", storePhone);
        values.put("vatRate", String.valueOf(vatRate));
        values.put("loyaltyRateVndPerPoint", String.valueOf(loyaltyRateVndPerPoint));
        values.put("pointRedeemValueVnd", String.valueOf(pointRedeemValueVnd));
        values.put("maxReservationGuests", String.valueOf(maxReservationGuests));
        values.put("autoCancelMinutes", String.valueOf(autoCancelMinutes));
        values.put("openingTime", openingTime.toString());
        values.put("closingTime", closingTime.toString());
        return store.saveAll(values);
    }

    private static void applyString(Map<String, String> saved, String key, Consumer<String> setter) {
        String value = saved.get(key);
        if (value != null && !value.isBlank()) {
            setter.accept(value);
        }
    }

    private static <T> void applyParsed(Map<String, String> saved, String key,
                                        Function<String, T> parser, Consumer<T> setter) {
        String value = saved.get(key);
        if (value == null) {
            return;
        }
        try {
            setter.accept(parser.apply(value));
        } catch (RuntimeException e) {
            LOGGER.log(Level.WARNING, "Ignoring saved setting " + key + "=" + value + ": " + e.getMessage());
        }
    }

    @Serial
    private Object readResolve() {
        return getInstance();
    }

    // Getter và setter

    public synchronized String getStoreName() {
        return storeName;
    }

    public synchronized void setStoreName(String storeName) {
        this.storeName = storeName;
    }

    public synchronized String getStoreAddress() {
        return storeAddress;
    }

    public synchronized void setStoreAddress(String storeAddress) {
        this.storeAddress = storeAddress;
    }

    public synchronized String getStorePhone() {
        return storePhone;
    }

    public synchronized void setStorePhone(String storePhone) {
        this.storePhone = storePhone;
    }

    public synchronized double getVatRate() {
        return vatRate;
    }

    public synchronized void setVatRate(double vatRate) {
        this.vatRate = vatRate;
    }

    public synchronized int getLoyaltyRateVndPerPoint() {
        return loyaltyRateVndPerPoint;
    }

    public synchronized void setLoyaltyRateVndPerPoint(int loyaltyRateVndPerPoint) {
        this.loyaltyRateVndPerPoint = Math.max(1, loyaltyRateVndPerPoint);
    }

    public synchronized int getPointRedeemValueVnd() {
        return pointRedeemValueVnd;
    }

    public synchronized void setPointRedeemValueVnd(int pointRedeemValueVnd) {
        this.pointRedeemValueVnd = Math.max(0, pointRedeemValueVnd);
    }

    public synchronized int getMaxReservationGuests() {
        return maxReservationGuests;
    }

    public synchronized void setMaxReservationGuests(int maxReservationGuests) {
        this.maxReservationGuests = Math.max(1, maxReservationGuests);
    }

    public synchronized int getAutoCancelMinutes() {
        return autoCancelMinutes;
    }

    public synchronized void setAutoCancelMinutes(int autoCancelMinutes) {
        this.autoCancelMinutes = Math.max(1, autoCancelMinutes);
    }

    public synchronized LocalTime getOpeningTime() {
        return openingTime;
    }

    public synchronized void setOpeningTime(LocalTime openingTime) {
        this.openingTime = openingTime != null ? openingTime : DEFAULT_OPENING_TIME;
    }

    public synchronized LocalTime getClosingTime() {
        return closingTime;
    }

    public synchronized void setClosingTime(LocalTime closingTime) {
        this.closingTime = closingTime != null ? closingTime : DEFAULT_CLOSING_TIME;
    }
}
