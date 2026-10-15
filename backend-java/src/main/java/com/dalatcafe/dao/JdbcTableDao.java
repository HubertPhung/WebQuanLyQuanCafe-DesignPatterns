package com.dalatcafe.dao;

import com.dalatcafe.model.Table;
import com.dalatcafe.model.TableStatus;

import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * JDBC PostgreSQL implementation of ITableDao.
 */
public class JdbcTableDao implements ITableDao {
    private static final Logger LOGGER = Logger.getLogger(JdbcTableDao.class.getName());

    @Override
    public List<Table> findAll() {
        List<Table> list = new ArrayList<>();
        String sql = "SELECT id, name, seats, zone, status, guest_count, occupied_since, updated_at FROM tables ORDER BY id ASC";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(mapResultSetToTable(rs));
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findAll tables via JDBC: " + e.getMessage(), e);
        }
        return list;
    }

    @Override
    public Optional<Table> findById(int id) {
        String sql = "SELECT id, name, seats, zone, status, guest_count, occupied_since, updated_at FROM tables WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapResultSetToTable(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findById table via JDBC: " + e.getMessage(), e);
        }
        return Optional.empty();
    }

    @Override
    public List<Table> findByZone(String zone) {
        List<Table> list = new ArrayList<>();
        String sql = "SELECT id, name, seats, zone, status, guest_count, occupied_since, updated_at FROM tables WHERE LOWER(zone) = LOWER(?) ORDER BY id ASC";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, zone);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapResultSetToTable(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findByZone tables via JDBC: " + e.getMessage(), e);
        }
        return list;
    }

    @Override
    public List<Table> findByStatus(TableStatus status) {
        List<Table> list = new ArrayList<>();
        if (status == null) return list;
        String sql = "SELECT id, name, seats, zone, status, guest_count, occupied_since, updated_at FROM tables WHERE UPPER(status) = ? ORDER BY id ASC";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status.name());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapResultSetToTable(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findByStatus tables via JDBC: " + e.getMessage(), e);
        }
        return list;
    }

    @Override
    public boolean save(Table table) {
        if (table == null) return false;
        String sql = """
            INSERT INTO tables (id, name, seats, zone, status, guest_count, occupied_since, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                seats = EXCLUDED.seats,
                zone = EXCLUDED.zone,
                status = EXCLUDED.status,
                guest_count = EXCLUDED.guest_count,
                occupied_since = EXCLUDED.occupied_since,
                updated_at = EXCLUDED.updated_at
        """;
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, table.getId());
            ps.setString(2, table.getName());
            ps.setInt(3, table.getSeats());
            ps.setString(4, table.getZone());
            ps.setString(5, table.getStatus() != null ? table.getStatus().name() : TableStatus.AVAILABLE.name());
            ps.setInt(6, table.getGuestCount());
            ps.setTimestamp(7, table.getOccupiedSince() != null ? Timestamp.from(table.getOccupiedSince()) : null);
            ps.setTimestamp(8, Timestamp.from(Instant.now()));
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error save table via JDBC: " + e.getMessage(), e);
            return false;
        }
    }

    @Override
    public boolean updateStatus(int id, TableStatus status, int guestCount) {
        String sql = "UPDATE tables SET status = ?, guest_count = ?, occupied_since = ?, updated_at = ? WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status != null ? status.name() : TableStatus.AVAILABLE.name());
            ps.setInt(2, guestCount);
            Timestamp occupiedSince = (status == TableStatus.OCCUPIED) ? Timestamp.from(Instant.now()) : null;
            ps.setTimestamp(3, occupiedSince);
            ps.setTimestamp(4, Timestamp.from(Instant.now()));
            ps.setInt(5, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error updateStatus table via JDBC: " + e.getMessage(), e);
            return false;
        }
    }

    @Override
    public boolean deleteById(int id) {
        String sql = "DELETE FROM tables WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error deleteById table via JDBC: " + e.getMessage(), e);
            return false;
        }
    }

    private Table mapResultSetToTable(ResultSet rs) throws SQLException {
        Table table = new Table();
        table.setId(rs.getInt("id"));
        table.setName(rs.getString("name"));
        table.setSeats(rs.getInt("seats"));
        table.setZone(rs.getString("zone"));

        String statusStr = rs.getString("status");
        if (statusStr != null) {
            try {
                table.setStatus(TableStatus.valueOf(statusStr.toUpperCase()));
            } catch (IllegalArgumentException e) {
                table.setStatus(TableStatus.AVAILABLE);
            }
        }
        table.setGuestCount(rs.getInt("guest_count"));

        Timestamp occSince = rs.getTimestamp("occupied_since");
        if (occSince != null) {
            table.setOccupiedSince(occSince.toInstant());
        }
        Timestamp updated = rs.getTimestamp("updated_at");
        if (updated != null) {
            table.setUpdatedAt(updated.toInstant());
        }
        return table;
    }
}

