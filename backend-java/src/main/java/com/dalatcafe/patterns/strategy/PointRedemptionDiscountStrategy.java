package com.dalatcafe.patterns.strategy;

import com.dalatcafe.model.Customer;
import com.dalatcafe.patterns.singleton.SystemConfigManager;

import java.util.Objects;

/**
 * Xếp chồng việc đổi điểm tích lũy lên một strategy khác (voucher hoặc hạng thành viên). Chỉ dùng
 * số điểm mà phần tạm tính còn lại hấp thụ được; số điểm đó được trả qua {@link #getPointsUsed()}
 * để nơi gọi trừ đúng số đã áp dụng. Mỗi instance phục vụ một lần checkout.
 */
public final class PointRedemptionDiscountStrategy implements IDiscountStrategy {
    private final IDiscountStrategy base;
    private final int requestedPoints;
    private int pointsUsed;

    public PointRedemptionDiscountStrategy(IDiscountStrategy base, int requestedPoints) {
        this.base = base == null ? new NoDiscountStrategy() : base;
        if (requestedPoints <= 0) {
            throw new IllegalArgumentException("Requested points must be greater than zero");
        }
        this.requestedPoints = requestedPoints;
    }

    @Override
    public double calculateDiscount(double subtotal, Customer customer) {
        Objects.requireNonNull(customer, "Redeeming points needs a known customer");
        double baseDiscount = base.calculateDiscount(subtotal, customer);
        SystemConfigManager config = SystemConfigManager.getInstance();
        double pointsDiscount;
        // Tính số điểm đổi và quy ra tiền theo cùng một giá trị điểm.
        synchronized (config) {
            int pointValue = config.getPointRedeemValueVnd();
            double room = Math.max(0, subtotal - baseDiscount);
            int affordable = pointValue <= 0 ? 0 : (int) Math.floor(room / pointValue);
            pointsUsed = Math.min(requestedPoints, Math.min(affordable, customer.getLoyaltyPoints()));
            pointsDiscount = config.calculateDiscountFromPoints(pointsUsed);
        }
        return DiscountAmounts.clamp(subtotal, baseDiscount + pointsDiscount);
    }

    /** Số điểm thực sự đã áp dụng ở lần gọi {@link #calculateDiscount} gần nhất. */
    public int getPointsUsed() {
        return pointsUsed;
    }

    @Override
    public String getDiscountDescription() {
        return base.getDiscountDescription() + " + đổi " + requestedPoints + " điểm";
    }
}
