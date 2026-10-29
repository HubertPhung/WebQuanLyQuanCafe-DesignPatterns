package com.dalatcafe.server;

import com.dalatcafe.dao.IVoucherDao;
import com.dalatcafe.model.Voucher;
import com.dalatcafe.model.VoucherType;
import com.dalatcafe.model.VoucherUsage;
import com.dalatcafe.patterns.strategy.DiscountContext;
import com.dalatcafe.patterns.strategy.FixedAmountDiscountStrategy;
import com.dalatcafe.patterns.strategy.IDiscountStrategy;
import com.dalatcafe.patterns.strategy.PercentageDiscountStrategy;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

/**
 * Mọi quy tắc của voucher ở một chỗ: kiểm tra mã (/api/vouchers/validate), giữ lượt khi đặt đơn
 * (checkout, đơn COD) và nhả lượt khi đơn bị hủy. Mức giảm luôn tính bằng đúng Strategy mà
 * checkout áp dụng, nên xem trước và tiền thực trừ không bao giờ lệch nhau.
 */
public class VoucherService {
    /** Thứ tự cũng là thứ tự kiểm tra: dừng ở điều kiện đầu tiên không qua. */
    public enum Reason {
        OK, NOT_FOUND, DISABLED, NOT_STARTED, EXPIRED, SOLD_OUT, LOGIN_REQUIRED, ACCOUNT_LIMIT, ONLINE_ONLY, BELOW_MIN_ORDER
    }

    public record Verdict(String code, Reason reason, String message, double discountAmount, double shortfall,
                          Voucher voucher) {
        public boolean valid() {
            return reason == Reason.OK;
        }
    }

    public record Redemption(int usageId, Voucher voucher, IDiscountStrategy strategy, double discountAmount) {
    }

    private final IVoucherDao dao;
    private final Clock clock;

    public VoucherService(IVoucherDao dao, Clock clock) {
        this.dao = Objects.requireNonNull(dao, "Voucher DAO must not be null");
        this.clock = Objects.requireNonNull(clock, "Clock must not be null");
    }

    public static String normalize(String code) {
        if (code == null || code.isBlank()) return null;
        return code.trim().toUpperCase(Locale.ROOT);
    }

    public static IDiscountStrategy strategyFor(Voucher voucher) {
        if (voucher.getType() == VoucherType.FIXED) {
            return new FixedAmountDiscountStrategy(voucher.getValue());
        }
        double cap = voucher.getMaxDiscount() == null ? Double.MAX_VALUE : voucher.getMaxDiscount();
        return new PercentageDiscountStrategy(voucher.getValue() / 100.0, cap);
    }

    public Instant now() {
        return clock.instant();
    }

    public Verdict check(String code, double subtotal, Integer userId, boolean storefront) {
        String normalized = normalize(code);
        Optional<Voucher> found = normalized == null ? Optional.empty() : dao.findByCode(normalized);
        if (found.isEmpty()) return reject(normalized, Reason.NOT_FOUND, "Mã không tồn tại.", null, 0);
        Voucher voucher = found.get();
        Instant now = clock.instant();
        if (!voucher.isActive()) return reject(voucher.getCode(), Reason.DISABLED, "Mã đã ngừng áp dụng.", voucher, 0);
        if (voucher.getStartDate() != null && now.atZone(Voucher.CAFE_ZONE).toLocalDate().isBefore(voucher.getStartDate())) {
            return reject(voucher.getCode(), Reason.NOT_STARTED, "Mã chưa đến ngày áp dụng.", voucher, 0);
        }
        if (!voucher.isWithinDates(now)) return reject(voucher.getCode(), Reason.EXPIRED, "Mã đã hết hạn.", voucher, 0);
        if (voucher.isSoldOut()) return reject(voucher.getCode(), Reason.SOLD_OUT, "Mã đã hết lượt sử dụng.", voucher, 0);
        if (voucher.getPerAccountLimit() != null) {
            // Quầy POS không biết tài khoản của khách: mã giới hạn theo tài khoản chỉ dùng khi đặt online.
            if (!storefront) return reject(voucher.getCode(), Reason.ONLINE_ONLY, "Mã này chỉ dùng khi đặt online.", voucher, 0);
            if (userId == null) return reject(voucher.getCode(), Reason.LOGIN_REQUIRED, "Đăng nhập để dùng mã này.", voucher, 0);
            if (dao.countUsages(voucher.getId(), userId) >= voucher.getPerAccountLimit()) {
                return reject(voucher.getCode(), Reason.ACCOUNT_LIMIT, "Tài khoản của bạn đã dùng hết lượt cho mã này.", voucher, 0);
            }
        }
        if (voucher.isFirstOnlineOrderOnly() && !storefront) {
            return reject(voucher.getCode(), Reason.ONLINE_ONLY, "Mã chỉ dùng cho đơn online đầu tiên.", voucher, 0);
        }
        if (subtotal < voucher.getMinOrder()) {
            double shortfall = voucher.getMinOrder() - subtotal;
            return reject(voucher.getCode(), Reason.BELOW_MIN_ORDER, String.format(Locale.ROOT,
                    "Đơn tối thiểu %,.0f đ, cần mua thêm %,.0f đ.", voucher.getMinOrder(), shortfall), voucher, shortfall);
        }
        double discount = new DiscountContext(strategyFor(voucher)).executeDiscount(subtotal, null);
        return new Verdict(voucher.getCode(), Reason.OK, voucher.getDescription(), discount, 0, voucher);
    }

    private static Verdict reject(String code, Reason reason, String message, Voucher voucher, double shortfall) {
        return new Verdict(code, reason, message, 0, shortfall, voucher);
    }

    /** Kiểm tra rồi giữ một lượt; mọi thất bại là 400 INVALID_VOUCHER với đúng lý do. */
    public Redemption redeem(String code, double subtotal, Integer userId, String orderCode, boolean storefront) {
        Verdict verdict = check(code, subtotal, userId, storefront);
        if (!verdict.valid()) throw invalid(verdict.message());
        Voucher voucher = verdict.voucher();
        IVoucherDao.RedeemResult result = dao.redeem(voucher.getId(), userId, orderCode, verdict.discountAmount());
        return switch (result.status()) {
            case REDEEMED -> new Redemption(result.usageId(), voucher, strategyFor(voucher), verdict.discountAmount());
            case SOLD_OUT -> throw invalid("Mã đã hết lượt sử dụng.");
            case ACCOUNT_LIMIT -> throw invalid("Tài khoản của bạn đã dùng hết lượt cho mã này.");
            case UNKNOWN_VOUCHER -> throw invalid("Mã không tồn tại.");
            case FAILED -> throw new ApiException(503, "DATABASE_UNAVAILABLE",
                    "Chưa giữ được lượt dùng mã lúc này. Vui lòng thử lại sau ít phút.");
        };
    }

    private static ApiException invalid(String message) {
        return new ApiException(400, "INVALID_VOUCHER", message);
    }

    /** False khi không gắn được lượt vào đơn; khi đó hủy đơn sẽ không tự trả lượt. */
    public boolean attachOrder(Redemption redemption, String orderCode) {
        return dao.attachOrder(redemption.usageId(), orderCode);
    }

    public boolean release(Redemption redemption) {
        return redemption != null && dao.releaseUsage(redemption.usageId());
    }

    public boolean releaseOrder(String orderCode) {
        return dao.releaseByOrder(orderCode);
    }

    public Optional<VoucherUsage> usageForOrder(String orderCode) {
        return dao.findUsageByOrder(orderCode);
    }

    public Optional<Voucher> findById(int id) {
        return dao.findById(id);
    }
}
