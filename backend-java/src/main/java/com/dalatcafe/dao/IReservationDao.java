package com.dalatcafe.dao;

import com.dalatcafe.model.Reservation;
import com.dalatcafe.model.ReservationStatus;

import java.util.List;
import java.util.Optional;

/**
 * Data Access Object interface for Reservation entity.
 */
public interface IReservationDao {
    List<Reservation> findAll();
    Optional<Reservation> findById(int id);
    Optional<Reservation> findByReservationCode(String code);
    List<Reservation> findByStatus(ReservationStatus status);
    boolean save(Reservation reservation);
    boolean updateStatus(int id, ReservationStatus status);
    boolean deleteById(int id);
}

