package com.dalatcafe.server;

import com.dalatcafe.patterns.strategy.IDiscountStrategy;
import com.dalatcafe.patterns.strategy.PercentageDiscountStrategy;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Các mã voucher mà checkout và POST /api/vouchers/validate chấp nhận, mỗi mã ứng với Strategy giảm
 * giá nó áp dụng. Gom về một chỗ, để kiểm tra và checkout không bao giờ lệch nhau.
 */
final class VoucherCatalog {
    static final String WELCOME10 = "WELCOME10";

    private static final Map<String, Supplier<IDiscountStrategy>> VOUCHERS = Map.of(
            WELCOME10, () -> new PercentageDiscountStrategy(0.10, 50_000));

    private VoucherCatalog() {
    }

    static Optional<IDiscountStrategy> find(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        Supplier<IDiscountStrategy> voucher = VOUCHERS.get(code.trim().toUpperCase(Locale.ROOT));
        return voucher == null ? Optional.empty() : Optional.of(voucher.get());
    }
}
