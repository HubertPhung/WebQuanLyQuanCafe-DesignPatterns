package com.dalatcafe.patterns.chain;

import com.dalatcafe.model.Reservation;

public abstract class ReservationValidatorHandler {
    protected ReservationValidatorHandler nextHandler;

    public void setNext(ReservationValidatorHandler next) {
        // Từ chối vòng lặp khi lắp hoặc nối dài chuỗi.
        for (ReservationValidatorHandler handler = next; handler != null; handler = handler.nextHandler) {
            if (handler == this) {
                throw new IllegalArgumentException("Validation chain must not contain a cycle");
            }
        }
        nextHandler = next;
    }

    public abstract ValidationResult validate(Reservation reservation);

    protected ValidationResult checkNext(Reservation reservation) {
        return nextHandler == null ? ValidationResult.valid() : nextHandler.validate(reservation);
    }
}
