package com.dalatcafe.dao;

import com.dalatcafe.model.Reservation;
import com.dalatcafe.model.ReservationStatus;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Bản cài đặt IReservationDao trong bộ nhớ, dùng collection an toàn đa luồng.
 */
public class InMemoryReservationDao implements IReservationDao {
    private final InMemoryDatabase db;

    public InMemoryReservationDao() {
        this(InMemoryDatabase.getInstance());
    }

    public InMemoryReservationDao(InMemoryDatabase db) {
        this.db = db;
    }

    @Override
    public List<Reservation> findAll() {
        return db.getReservations().values().stream()
                .sorted(Comparator.comparing(Reservation::getDateTime))
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Reservation> findById(int id) {
        return Optional.ofNullable(db.getReservations().get(id));
    }

    @Override
    public Optional<Reservation> findByReservationCode(String code) {
        if (code == null) return Optional.empty();
        return db.getReservations().values().stream()
                .filter(r -> code.equalsIgnoreCase(r.getReservationCode()))
                .findFirst();
    }

    @Override
    public List<Reservation> findByStatus(ReservationStatus status) {
        if (status == null) return new ArrayList<>();
        return db.getReservations().values().stream()
                .filter(r -> r.getStatus() == status)
                .sorted(Comparator.comparing(Reservation::getDateTime))
                .collect(Collectors.toList());
    }

    @Override
    public boolean save(Reservation reservation) {
        if (reservation == null) return false;
        if (reservation.getId() == null) {
            reservation.setId(db.generateReservationId());
        }
        if (reservation.getReservationCode() == null || reservation.getReservationCode().isBlank()) {
            reservation.setReservationCode("RES-" + String.format("%04d", reservation.getId()));
        }
        db.getReservations().put(reservation.getId(), reservation);
        return true;
    }

    @Override
    public boolean updateStatus(int id, ReservationStatus status) {
        Reservation reservation = db.getReservations().get(id);
        if (reservation == null) return false;
        reservation.setStatus(status);
        return true;
    }

    @Override
    public boolean deleteById(int id) {
        return db.getReservations().remove(id) != null;
    }
}

