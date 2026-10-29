package com.dalatcafe.patterns.chain;

import com.dalatcafe.dao.IReservationDao;
import com.dalatcafe.model.Reservation;
import com.dalatcafe.model.ReservationStatus;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

public final class TableAvailabilityValidator extends ReservationValidatorHandler {
    /** Thời gian giữ bàn của phiếu không lưu giờ kết thúc. */
    public static final Duration DEFAULT_DURATION = Reservation.DEFAULT_LENGTH;
    private final IReservationDao reservationDao;
    private final Duration duration;

    public TableAvailabilityValidator(IReservationDao reservationDao) {
        this(reservationDao, DEFAULT_DURATION);
    }

    /**
     * Mỗi phiếu giữ bàn trong khoảng [bắt đầu, kết thúc) của nó; {@code duration} là độ dài giả định
     * cho phiếu không lưu giờ kết thúc (phiếu cũ).
     */
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
        Instant requestedEnd;
        try {
            requestedEnd = endOf(reservation);
        } catch (DateTimeException | ArithmeticException ex) {
            return ValidationResult.invalid("Thời gian kết thúc đặt bàn không hợp lệ.");
        }
        for (Reservation existing : reservationDao.findAll()) {
            if (reservation.getTableIds().stream().noneMatch(existing.getTableIds()::contains)
                    || existing.getStatus() == ReservationStatus.CANCELLED
                    || (reservation.getId() != null && reservation.getId().equals(existing.getId()))) {
                continue;
            }
            // Trạng thái lưu không rõ ràng thì không thể khẳng định an toàn là bàn còn trống.
            if (existing.getDateTime() == null || existing.getStatus() == null) {
                return ValidationResult.invalid("Lịch của bàn thiếu dữ liệu; vui lòng kiểm tra lại.");
            }
            Instant existingEnd;
            try {
                existingEnd = endOf(existing);
            } catch (DateTimeException | ArithmeticException ex) {
                return ValidationResult.invalid("Thời gian trong lịch của bàn không hợp lệ.");
            }
            if (slotsOverlap(reservation.getDateTime(), requestedEnd, existing.getDateTime(), existingEnd)) {
                return ValidationResult.invalid("Bàn đã được đặt trong khung giờ này.");
            }
        }
        return checkNext(reservation);
    }

    private Instant endOf(Reservation reservation) {
        Instant stored = reservation.getStoredEndTime();
        return stored != null ? stored : reservation.getDateTime().plus(duration);
    }

    /** Khoảng nửa mở [start, end): một bàn được đặt lại đúng lúc khoảng trước kết thúc. */
    public static boolean slotsOverlap(Instant aStart, Instant aEnd, Instant bStart, Instant bEnd) {
        return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
    }
}
