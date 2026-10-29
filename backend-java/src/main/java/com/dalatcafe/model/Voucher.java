package com.dalatcafe.model;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Thực thể Voucher: một mã giảm giá admin tạo cho một dịp sale. maxUses và perAccountLimit null
 * nghĩa là không giới hạn.
 */
public class Voucher {
    /** Ngày bắt đầu và hết hạn tính theo giờ của quán, không theo múi giờ của máy chủ. */
    public static final ZoneId CAFE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Trạng thái hiển thị cho admin, tính ra từ dữ liệu chứ không lưu. */
    public enum VoucherState {
        UPCOMING, RUNNING, EXPIRED, SOLD_OUT, DISABLED
    }

    private Integer id;
    private String code;
    private VoucherType type = VoucherType.PERCENT;
    private double value;
    private Double maxDiscount;
    private double minOrder;
    private Integer maxUses;
    private Integer perAccountLimit;
    private boolean firstOnlineOrderOnly;
    private LocalDate startDate;
    private LocalDate endDate;
    private String description;
    private boolean active = true;
    private int usedCount;
    private Instant createdAt = Instant.now();

    /** Mã hợp lệ từ 00:00 ngày bắt đầu đến hết 23:59:59 ngày hết hạn, giờ Việt Nam. */
    public boolean isWithinDates(Instant now) {
        if (startDate == null || endDate == null || now == null) return false;
        LocalDate today = now.atZone(CAFE_ZONE).toLocalDate();
        return !today.isBefore(startDate) && !today.isAfter(endDate);
    }

    public boolean isSoldOut() {
        return maxUses != null && usedCount >= maxUses;
    }

    /** Đã tắt được ưu tiên trước, rồi tới hết hạn, hết lượt, chưa tới ngày. */
    public VoucherState stateAt(Instant now) {
        if (!active) return VoucherState.DISABLED;
        LocalDate today = now.atZone(CAFE_ZONE).toLocalDate();
        if (endDate != null && today.isAfter(endDate)) return VoucherState.EXPIRED;
        if (isSoldOut()) return VoucherState.SOLD_OUT;
        if (startDate != null && today.isBefore(startDate)) return VoucherState.UPCOMING;
        return VoucherState.RUNNING;
    }

    public Voucher copy() {
        Voucher v = new Voucher();
        v.id = id;
        v.code = code;
        v.type = type;
        v.value = value;
        v.maxDiscount = maxDiscount;
        v.minOrder = minOrder;
        v.maxUses = maxUses;
        v.perAccountLimit = perAccountLimit;
        v.firstOnlineOrderOnly = firstOnlineOrderOnly;
        v.startDate = startDate;
        v.endDate = endDate;
        v.description = description;
        v.active = active;
        v.usedCount = usedCount;
        v.createdAt = createdAt;
        return v;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public VoucherType getType() {
        return type;
    }

    public void setType(VoucherType type) {
        this.type = type;
    }

    public double getValue() {
        return value;
    }

    public void setValue(double value) {
        this.value = value;
    }

    public Double getMaxDiscount() {
        return maxDiscount;
    }

    public void setMaxDiscount(Double maxDiscount) {
        this.maxDiscount = maxDiscount;
    }

    public double getMinOrder() {
        return minOrder;
    }

    public void setMinOrder(double minOrder) {
        this.minOrder = minOrder;
    }

    public Integer getMaxUses() {
        return maxUses;
    }

    public void setMaxUses(Integer maxUses) {
        this.maxUses = maxUses;
    }

    public Integer getPerAccountLimit() {
        return perAccountLimit;
    }

    public void setPerAccountLimit(Integer perAccountLimit) {
        this.perAccountLimit = perAccountLimit;
    }

    public boolean isFirstOnlineOrderOnly() {
        return firstOnlineOrderOnly;
    }

    public void setFirstOnlineOrderOnly(boolean firstOnlineOrderOnly) {
        this.firstOnlineOrderOnly = firstOnlineOrderOnly;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public int getUsedCount() {
        return usedCount;
    }

    public void setUsedCount(int usedCount) {
        this.usedCount = usedCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
