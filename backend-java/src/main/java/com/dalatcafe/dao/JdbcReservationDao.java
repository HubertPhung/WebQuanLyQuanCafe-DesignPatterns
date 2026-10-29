package com.dalatcafe.dao;

import com.dalatcafe.model.Reservation;
import com.dalatcafe.model.ReservationStatus;

import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Bản cài đặt IReservationDao bằng JDBC PostgreSQL.
 */
public class JdbcReservationDao implements IReservationDao {
    private static final Logger LOGGER = Logger.getLogger(JdbcReservationDao.class.getName());

    @Override
    public List<Reservation> findAll() {
        List<Reservation> list = new ArrayList<>();
        String sql = "SELECT id, reservation_code, customer, contact, email, date_time, table_name, table_id, guests, status, note, created_at, pre_orders, table_ids, branch, user_id, end_time FROM reservations ORDER BY date_time ASC";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(mapResultSetToReservation(rs));
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findAll reservations via JDBC: " + e.getMessage(), e);
            throw new IllegalStateException("Không đọc được lịch đặt bàn; chưa thể xác nhận bàn trống.", e);
        }
        return list;
    }

    @Override
    public Optional<Reservation> findById(int id) {
        String sql = "SELECT id, reservation_code, customer, contact, email, date_time, table_name, table_id, guests, status, note, created_at, pre_orders, table_ids, branch, user_id, end_time FROM reservations WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapResultSetToReservation(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findById reservation via JDBC: " + e.getMessage(), e);
        }
        return Optional.empty();
    }

    @Override
    public Optional<Reservation> findByReservationCode(String code) {
        if (code == null) return Optional.empty();
        String sql = "SELECT id, reservation_code, customer, contact, email, date_time, table_name, table_id, guests, status, note, created_at, pre_orders, table_ids, branch, user_id, end_time FROM reservations WHERE LOWER(reservation_code) = LOWER(?)";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, code);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapResultSetToReservation(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findByReservationCode via JDBC: " + e.getMessage(), e);
        }
        return Optional.empty();
    }

    @Override
    public List<Reservation> findByStatus(ReservationStatus status) {
        List<Reservation> list = new ArrayList<>();
        if (status == null) return list;
        String sql = "SELECT id, reservation_code, customer, contact, email, date_time, table_name, table_id, guests, status, note, created_at, pre_orders, table_ids, branch, user_id, end_time FROM reservations WHERE UPPER(status) = ? ORDER BY date_time ASC";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status.name());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapResultSetToReservation(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findByStatus reservations via JDBC: " + e.getMessage(), e);
        }
        return list;
    }

    @Override
    public List<Reservation> findForAccount(int userId, String email) {
        String sql = "SELECT * FROM reservations WHERE user_id = ? OR (user_id IS NULL AND ? <> '' "
                + "AND LOWER(BTRIM(email)) = ?) ORDER BY date_time DESC LIMIT 50";
        String normalizedEmail = email == null ? "" : email.trim().toLowerCase(java.util.Locale.ROOT);
        try (Connection conn = JdbcDatabase.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, userId);
            ps.setString(2, normalizedEmail);
            ps.setString(3, normalizedEmail);
            try (ResultSet rs = ps.executeQuery()) {
                List<Reservation> result = new ArrayList<>();
                while (rs.next()) result.add(mapResultSetToReservation(rs));
                return result;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not load reservation history", e);
        }
    }

    @Override
    public boolean save(Reservation res) {
        if (res == null) return false;
        if (res.getId() != null && res.getId() > 0) {
            String sql = """
                INSERT INTO reservations (id, reservation_code, customer, contact, email, date_time, table_name, table_id, guests, status, note, created_at, pre_orders, table_ids, branch, user_id, end_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB), CAST(? AS JSONB), ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    reservation_code = EXCLUDED.reservation_code,
                    customer = EXCLUDED.customer,
                    contact = EXCLUDED.contact,
                    email = EXCLUDED.email,
                    date_time = EXCLUDED.date_time,
                    table_name = EXCLUDED.table_name,
                    table_id = EXCLUDED.table_id,
                    guests = EXCLUDED.guests,
                    status = EXCLUDED.status,
                    note = EXCLUDED.note,
                    pre_orders = EXCLUDED.pre_orders, table_ids = EXCLUDED.table_ids, branch = EXCLUDED.branch, user_id = EXCLUDED.user_id,
                    end_time = EXCLUDED.end_time
            """;
            try (Connection conn = JdbcDatabase.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql)) {
                fillReservationPreparedStatement(ps, res, res.getId());
                return ps.executeUpdate() > 0;
            } catch (SQLException e) {
                LOGGER.log(Level.SEVERE, "Error save existing reservation via JDBC: " + e.getMessage(), e);
                return false;
            }
        } else {
            String sql = """
                INSERT INTO reservations (reservation_code, customer, contact, email, date_time, table_name, table_id, guests, status, note, created_at, pre_orders, table_ids, branch, user_id, end_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB), CAST(? AS JSONB), ?, ?, ?)
            """;
            try (Connection conn = JdbcDatabase.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                String code = res.getReservationCode();
                boolean generated = code == null || code.isBlank();
                // Giá trị tạm duy nhất cho tới khi biết id; bên dưới sẽ đổi sang dạng RES-0001.
                ps.setString(1, generated ? "TMP-" + UUID.randomUUID() : code);
                ps.setString(2, res.getCustomer());
                ps.setString(3, res.getContact());
                ps.setString(4, res.getEmail());
                ps.setTimestamp(5, Timestamp.from(res.getDateTime() != null ? res.getDateTime() : Instant.now()));
                ps.setString(6, res.getTableName());
                if (res.getTableId() != null) {
                    ps.setInt(7, res.getTableId());
                } else {
                    ps.setNull(7, Types.INTEGER);
                }
                ps.setInt(8, res.getGuests());
                ps.setString(9, res.getStatus() != null ? res.getStatus().name() : ReservationStatus.PENDING.name());
                ps.setString(10, res.getNote());
                ps.setTimestamp(11, Timestamp.from(res.getCreatedAt() != null ? res.getCreatedAt() : Instant.now()));
                ps.setString(12, JsonColumns.fromItems(res.getPreOrders()));
                ps.setString(13, JsonColumns.fromIds(res.getTableIds()));
                ps.setString(14, res.getBranch());
                ps.setObject(15, res.getUserId(), Types.INTEGER);
                ps.setTimestamp(16, endTimestamp(res));

                int rows = ps.executeUpdate();
                if (rows > 0) {
                    try (ResultSet keys = ps.getGeneratedKeys()) {
                        if (keys.next()) {
                            res.setId(keys.getInt(1));
                        }
                    }
                    if (generated && res.getId() != null) {
                        String finalCode = "RES-" + String.format("%04d", res.getId());
                        try (PreparedStatement rename = conn.prepareStatement(
                                "UPDATE reservations SET reservation_code = ? WHERE id = ?")) {
                            rename.setString(1, finalCode);
                            rename.setInt(2, res.getId());
                            rename.executeUpdate();
                        }
                        res.setReservationCode(finalCode);
                    }
                    return true;
                }
            } catch (SQLException e) {
                LOGGER.log(Level.SEVERE, "Error insert new reservation via JDBC: " + e.getMessage(), e);
            }
            return false;
        }
    }

    private void fillReservationPreparedStatement(PreparedStatement ps, Reservation res, int id) throws SQLException {
        ps.setInt(1, id);
        ps.setString(2, res.getReservationCode());
        ps.setString(3, res.getCustomer());
        ps.setString(4, res.getContact());
        ps.setString(5, res.getEmail());
        ps.setTimestamp(6, Timestamp.from(res.getDateTime() != null ? res.getDateTime() : Instant.now()));
        ps.setString(7, res.getTableName());
        if (res.getTableId() != null) {
            ps.setInt(8, res.getTableId());
        } else {
            ps.setNull(8, Types.INTEGER);
        }
        ps.setInt(9, res.getGuests());
        ps.setString(10, res.getStatus() != null ? res.getStatus().name() : ReservationStatus.PENDING.name());
        ps.setString(11, res.getNote());
        ps.setTimestamp(12, Timestamp.from(res.getCreatedAt() != null ? res.getCreatedAt() : Instant.now()));
        ps.setString(13, JsonColumns.fromItems(res.getPreOrders()));
        ps.setString(14, JsonColumns.fromIds(res.getTableIds()));
        ps.setString(15, res.getBranch());
        ps.setObject(16, res.getUserId(), Types.INTEGER);
        ps.setTimestamp(17, endTimestamp(res));
    }

    /** Phiếu cũ không có giờ kết thúc được lưu NULL, không lưu giá trị mặc định đã suy ra. */
    private static Timestamp endTimestamp(Reservation res) {
        return res.getStoredEndTime() == null ? null : Timestamp.from(res.getStoredEndTime());
    }

    @Override
    public boolean updateStatus(int id, ReservationStatus status) {
        String sql = "UPDATE reservations SET status = ? WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status != null ? status.name() : ReservationStatus.PENDING.name());
            ps.setInt(2, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error updateStatus reservation via JDBC: " + e.getMessage(), e);
            return false;
        }
    }

    @Override
    public boolean deleteById(int id) {
        String sql = "DELETE FROM reservations WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error deleteById reservation via JDBC: " + e.getMessage(), e);
            return false;
        }
    }

    private Reservation mapResultSetToReservation(ResultSet rs) throws SQLException {
        Reservation res = new Reservation();
        res.setTableIds(JsonColumns.toIds(rs.getString("table_ids")));
        res.setBranch(rs.getString("branch"));
        res.setId(rs.getInt("id"));
        res.setReservationCode(rs.getString("reservation_code"));
        res.setCustomer(rs.getString("customer"));
        res.setContact(rs.getString("contact"));
        res.setEmail(rs.getString("email"));
        res.setUserId((Integer) rs.getObject("user_id"));

        Timestamp dt = rs.getTimestamp("date_time");
        if (dt != null) {
            res.setDateTime(dt.toInstant());
        }
        Timestamp end = rs.getTimestamp("end_time");
        if (end != null) {
            res.setEndTime(end.toInstant());
        }

        res.setTableName(rs.getString("table_name"));
        int tableId = rs.getInt("table_id");
        if (!rs.wasNull()) {
            res.setTableId(tableId);
        }
        res.setGuests(rs.getInt("guests"));

        String statusStr = rs.getString("status");
        if (statusStr != null) {
            try {
                res.setStatus(ReservationStatus.valueOf(statusStr.toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }

        res.setNote(rs.getString("note"));
        res.setPreOrders(JsonColumns.toItems(rs.getString("pre_orders")));
        Timestamp created = rs.getTimestamp("created_at");
        if (created != null) {
            res.setCreatedAt(created.toInstant());
        }
        return res;
    }
}

