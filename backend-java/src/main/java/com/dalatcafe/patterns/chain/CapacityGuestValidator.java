package com.dalatcafe.patterns.chain;

import com.dalatcafe.dao.ITableDao;
import com.dalatcafe.model.Reservation;
import com.dalatcafe.model.Table;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import java.util.Objects;

public final class CapacityGuestValidator extends ReservationValidatorHandler {
    private final ITableDao tableDao;

    public CapacityGuestValidator(ITableDao tableDao) {
        this.tableDao = Objects.requireNonNull(tableDao, "Table DAO must not be null");
    }

    @Override
    public ValidationResult validate(Reservation reservation) {
        if (reservation == null || reservation.getTableId() == null) {
            return ValidationResult.invalid("Vui lòng chọn bàn.");
        }
        int maxGuests = SystemConfigManager.getInstance().getMaxReservationGuests();
        if (reservation.getGuests() < 1 || reservation.getGuests() > maxGuests) {
            return ValidationResult.invalid("Số lượng khách phải từ 1 đến " + maxGuests + " người.");
        }
        Table table = tableDao.findById(reservation.getTableId()).orElse(null);
        if (table == null) {
            return ValidationResult.invalid("Bàn được chọn không tồn tại.");
        }
        if (reservation.getGuests() > table.getSeats()) {
            return ValidationResult.invalid("Số lượng khách vượt sức chứa của bàn (" + table.getSeats() + " người).");
        }
        return checkNext(reservation);
    }
}
