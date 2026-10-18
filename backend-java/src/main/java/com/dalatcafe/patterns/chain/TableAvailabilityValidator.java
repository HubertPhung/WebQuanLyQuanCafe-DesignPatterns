package com.dalatcafe.patterns.chain;

import com.dalatcafe.dao.IReservationDao;
import com.dalatcafe.model.Reservation;
import com.dalatcafe.model.ReservationStatus;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

public final class TableAvailabilityValidator extends ReservationValidatorHandler {
    public static final Duration DEFAULT_DURATION = Duration.ofHours(2);
    private final IReservationDao reservationDao;
    private final Duration duration;

    public TableAvailabilityValidator(IReservationDao reservationDao) {
        this(reservationDao, DEFAULT_DURATION);
    }

    /** The same slot duration applies to both requested and existing bookings. */
    public TableAvailabilityValidator(IReservationDao reservationDao, Duration duration) {
        this.reservationDao = Objects.requireNonNull(reservationDao, "Reservation DAO must not be null");
        this.duration = Objects.requireNonNull(duration, "Duration must not be null");
        if (duration.isNegative() || duration.isZero()) {
            throw new IllegalArgumentException("Reservation duration must be positive");
        }
    }

    @Override
    public ValidationResult validate(Reservation reservation) {
        if (reservation == null || reservation.getTableId() == null || reservation.getDateTime() == null) {
            return ValidationResult.invalid("Vui lòng cung cấp bàn và thời gian đặt bàn.");
        }
        Instant end;
        try {
            end = reservation.getDateTime().plus(duration);
        } catch (DateTimeException | ArithmeticException ex) {
            return ValidationResult.invalid("Thời gian kết thúc đặt bàn không hợp lệ.");
        }
        for (Reservation existing : reservationDao.findAll()) {
            if (reservation.getTableIds().stream().noneMatch(existing.getTableIds()::contains)
                    || existing.getStatus() == ReservationStatus.CANCELLED
                    || (reservation.getId() != null && reservation.getId().equals(existing.getId()))) {
                continue;
            }
            // Unknown persisted state cannot safely establish availability.
            if (existing.getDateTime() == null || existing.getStatus() == null) {
                return ValidationResult.invalid("Lịch của bàn thiếu dữ liệu; vui lòng kiểm tra lại.");
            }
            Instant existingEnd;
            try {
                existingEnd = existing.getDateTime().plus(duration);
            } catch (DateTimeException | ArithmeticException ex) {
                return ValidationResult.invalid("Thời gian trong lịch của bàn không hợp lệ.");
            }
            if (reservation.getDateTime().isBefore(existingEnd) && existing.getDateTime().isBefore(end)) {
                return ValidationResult.invalid("Bàn đã được đặt trong khung giờ này.");
            }
        }
        return checkNext(reservation);
    }
}
