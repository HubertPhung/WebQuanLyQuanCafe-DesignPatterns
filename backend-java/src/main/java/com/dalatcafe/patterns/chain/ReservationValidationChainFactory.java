package com.dalatcafe.patterns.chain;

import com.dalatcafe.dao.IReservationDao;
import com.dalatcafe.dao.ITableDao;
import java.time.Duration;

public final class ReservationValidationChainFactory {
    private ReservationValidationChainFactory() {}

    public static ReservationValidatorHandler create(ITableDao tableDao, IReservationDao reservationDao) {
        return create(tableDao, reservationDao, TableAvailabilityValidator.DEFAULT_DURATION);
    }

    public static ReservationValidatorHandler create(
            ITableDao tableDao, IReservationDao reservationDao, Duration duration) {
        ReservationValidatorHandler hours = new OperatingHoursValidator();
        ReservationValidatorHandler capacity = new CapacityGuestValidator(tableDao);
        hours.setNext(capacity);
        capacity.setNext(new TableAvailabilityValidator(reservationDao, duration));
        return hours;
    }
}
