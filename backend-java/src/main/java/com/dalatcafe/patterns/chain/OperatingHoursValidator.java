package com.dalatcafe.patterns.chain;

import com.dalatcafe.model.Reservation;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Objects;

public final class OperatingHoursValidator extends ReservationValidatorHandler {
    private static final ZoneId CAFE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Phiếu nhập cho thời điểm "bây giờ" (chính xác tới phút) đã bắt đầu ngay khi được gửi đi. */
    public static final Duration PAST_GRACE = Duration.ofMinutes(15);
    /** Một phiếu giữ bàn ít nhất 30 phút. */
    public static final Duration MIN_LENGTH = Duration.ofMinutes(30);
    private final Clock clock;

    public OperatingHoursValidator() {
        this(Clock.systemUTC());
    }

    public OperatingHoursValidator(Clock clock) {
        this.clock = Objects.requireNonNull(clock, "Clock must not be null");
    }

    @Override
    public ValidationResult validate(Reservation reservation) {
        if (reservation == null || reservation.getDateTime() == null) {
            return ValidationResult.invalid("Vui lòng cung cấp thời gian đặt bàn.");
        }
        if (reservation.getDateTime().isBefore(clock.instant().minus(PAST_GRACE))) {
            return ValidationResult.invalid("Không thể đặt bàn cho thời điểm đã qua.");
        }
        SystemConfigManager config = SystemConfigManager.getInstance();
        LocalTime bookingTime;
        try {
            bookingTime = reservation.getDateTime().atZone(CAFE_ZONE).toLocalTime();
        } catch (DateTimeException ex) {
            return ValidationResult.invalid("Thời gian đặt bàn không hợp lệ.");
        }
        // Phép kiểm tra và giờ mở cửa ghi trong thông báo lấy từ cùng một lần cập nhật cài đặt,
        // không lấy lẫn trước và sau cập nhật.
        synchronized (config) {
            if (!config.isWithinOperatingHours(bookingTime)) {
                return ValidationResult.invalid("Quán chỉ nhận đặt bàn trong giờ mở cửa ("
                        + config.getOpeningTime() + " - " + config.getClosingTime() + ").");
            }
            ValidationResult end = checkEnd(reservation, config.getClosingTime());
            if (end != null) {
                return end;
            }
        }
        return checkNext(reservation);
    }

    /**
     * Giờ kết thúc khách chọn: cùng ngày, sau giờ bắt đầu ít nhất {@link #MIN_LENGTH}, không quá giờ
     * đóng cửa. Phiếu chưa có giờ kết thúc (phiếu cũ) không bị kiểm tra lại ở đây.
     */
    private static ValidationResult checkEnd(Reservation reservation, LocalTime closing) {
        if (reservation.getStoredEndTime() == null) {
            return null;
        }
        java.time.ZonedDateTime start;
        java.time.ZonedDateTime end;
        try {
            start = reservation.getDateTime().atZone(CAFE_ZONE);
            end = reservation.getStoredEndTime().atZone(CAFE_ZONE);
        } catch (DateTimeException ex) {
            return ValidationResult.invalid("Giờ kết thúc không hợp lệ.");
        }
        if (start.plus(MIN_LENGTH).isAfter(end)) {
            return ValidationResult.invalid("Giờ kết thúc phải sau giờ bắt đầu ít nhất 30 phút.");
        }
        if (!end.toLocalDate().equals(start.toLocalDate())) {
            return ValidationResult.invalid("Giờ kết thúc không hợp lệ.");
        }
        if (end.toLocalTime().isAfter(closing)) {
            return ValidationResult.invalid("Giờ kết thúc không được quá giờ đóng cửa (" + closing + ").");
        }
        return null;
    }
}
