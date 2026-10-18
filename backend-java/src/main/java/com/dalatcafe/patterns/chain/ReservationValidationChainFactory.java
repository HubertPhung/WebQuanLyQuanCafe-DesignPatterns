package com.dalatcafe.patterns.chain;

import com.dalatcafe.dao.IReservationDao;
import com.dalatcafe.dao.ITableDao;
import java.time.Clock;
import java.time.Duration;

public final class ReservationValidationChainFactory {
    private ReservationValidationChainFactory() {}

    public static ReservationValidatorHandler create(ITableDao tableDao, IReservationDao reservationDao) {
        return create(tableDao, reservationDao, TableAvailabilityValidator.DEFAULT_DURATION);
    }

    public static ReservationValidatorHandler create(
            ITableDao tableDao, IReservationDao reservationDao, Duration duration) {
        return create(tableDao, reservationDao, duration, Clock.systemUTC());
    }

    /** The clock decides which booking times are already in the past. */
    public static ReservationValidatorHandler create(
            ITableDao tableDao, IReservationDao reservationDao, Duration duration, Clock clock) {
        ReservationValidatorHandler hours = new OperatingHoursValidator(clock);
        ReservationValidatorHandler capacity = new CapacityGuestValidator(tableDao);
        hours.setNext(capacity);
        capacity.setNext(new TableAvailabilityValidator(reservationDao, duration));
        return hours;
    }
}
