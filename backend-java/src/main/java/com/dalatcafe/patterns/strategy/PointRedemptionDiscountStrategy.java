package com.dalatcafe.patterns.strategy;

import com.dalatcafe.model.Customer;
import com.dalatcafe.patterns.singleton.SystemConfigManager;

import java.util.Objects;

/**
 * Stacks a loyalty-point redemption on top of another strategy (voucher or member tier).
 * Only as many points as the remaining subtotal can absorb are used; the count is exposed
 * through {@link #getPointsUsed()} so the caller deducts exactly what was applied.
 * One instance serves one checkout.
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
        // Size the redemption and price it with the same point value.
        synchronized (config) {
            int pointValue = config.getPointRedeemValueVnd();
            double room = Math.max(0, subtotal - baseDiscount);
            int affordable = pointValue <= 0 ? 0 : (int) Math.floor(room / pointValue);
            pointsUsed = Math.min(requestedPoints, Math.min(affordable, customer.getLoyaltyPoints()));
            pointsDiscount = config.calculateDiscountFromPoints(pointsUsed);
        }
        return DiscountAmounts.clamp(subtotal, baseDiscount + pointsDiscount);
    }

    /** Points actually applied by the last {@link #calculateDiscount} call. */
    public int getPointsUsed() {
        return pointsUsed;
    }

    @Override
    public String getDiscountDescription() {
        return base.getDiscountDescription() + " + đổi " + requestedPoints + " điểm";
    }
}
