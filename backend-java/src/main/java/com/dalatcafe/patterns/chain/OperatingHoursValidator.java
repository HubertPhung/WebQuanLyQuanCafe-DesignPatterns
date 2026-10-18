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
    /** A booking keyed in for "now" (minute precision) has already begun by the time it is sent. */
    public static final Duration PAST_GRACE = Duration.ofMinutes(15);
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
        // The check and the quoted hours come from one settings update, not from either side of one.
        synchronized (config) {
            if (!config.isWithinOperatingHours(bookingTime)) {
                return ValidationResult.invalid("Quán chỉ nhận đặt bàn trong giờ mở cửa ("
                        + config.getOpeningTime() + " - " + config.getClosingTime() + ").");
            }
        }
        return checkNext(reservation);
    }
}
