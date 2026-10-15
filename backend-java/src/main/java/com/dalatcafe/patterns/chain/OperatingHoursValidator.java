package com.dalatcafe.patterns.chain;

import com.dalatcafe.model.Reservation;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import java.time.DateTimeException;
import java.time.LocalTime;
import java.time.ZoneId;

public final class OperatingHoursValidator extends ReservationValidatorHandler {
    private static final ZoneId CAFE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Override
    public ValidationResult validate(Reservation reservation) {
        if (reservation == null || reservation.getDateTime() == null) {
            return ValidationResult.invalid("Vui lòng cung cấp thời gian đặt bàn.");
        }
        SystemConfigManager config = SystemConfigManager.getInstance();
        LocalTime bookingTime;
        try {
            bookingTime = reservation.getDateTime().atZone(CAFE_ZONE).toLocalTime();
        } catch (DateTimeException ex) {
            return ValidationResult.invalid("Thời gian đặt bàn không hợp lệ.");
        }
        if (!config.isWithinOperatingHours(bookingTime)) {
            return ValidationResult.invalid("Quán chỉ nhận đặt bàn trong giờ mở cửa ("
                    + config.getOpeningTime() + " - " + config.getClosingTime() + ").");
        }
        return checkNext(reservation);
    }
}
