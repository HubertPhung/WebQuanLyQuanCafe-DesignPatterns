package com.dalatcafe.dao;

import com.dalatcafe.model.UserAccount;
import com.dalatcafe.model.UserRole;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * JDBC PostgreSQL implementation of IUserDao (table {@code users}). Uniqueness of the email and
 * the Google subject is enforced by the database, so a duplicate makes {@link #save} return false.
 */
public class JdbcUserDao implements IUserDao {
    private static final Logger LOGGER = Logger.getLogger(JdbcUserDao.class.getName());
    private static final String COLUMNS =
            "id, email, name, password_hash, google_subject, role, active, created_at, last_login_at";

    @Override
    public List<UserAccount> findAll() {
        List<UserAccount> list = new ArrayList<>();
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement("SELECT " + COLUMNS + " FROM users ORDER BY id");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(map(rs));
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findAll users via JDBC: " + e.getMessage(), e);
        }
        return list;
    }

    @Override
    public Optional<UserAccount> findById(int id) {
        return findOne("SELECT " + COLUMNS + " FROM users WHERE id = ?", ps -> ps.setInt(1, id));
    }

    @Override
    public Optional<UserAccount> findByEmail(String email) {
        String wanted = UserAccount.normalizeEmail(email);
        if (wanted == null) return Optional.empty();
        return findOne("SELECT " + COLUMNS + " FROM users WHERE email = ?", ps -> ps.setString(1, wanted));
    }

    @Override
    public Optional<UserAccount> findByGoogleSubject(String googleSubject) {
        if (googleSubject == null) return Optional.empty();
        return findOne("SELECT " + COLUMNS + " FROM users WHERE google_subject = ?", ps -> ps.setString(1, googleSubject));
    }

    @Override
    public boolean save(UserAccount user) {
        if (user == null || user.getEmail() == null) return false;
        boolean insert = user.getId() == null;
        String sql = insert
                ? "INSERT INTO users (email, name, password_hash, google_subject, role, active, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
                : "UPDATE users SET email = ?, name = ?, password_hash = ?, google_subject = ?, role = ?, active = ?, created_at = ?, last_login_at = ? WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = insert
                     ? conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)
                     : conn.prepareStatement(sql)) {
            ps.setString(1, user.getEmail());
            ps.setString(2, user.getName());
            ps.setString(3, user.getPasswordHash());
            ps.setString(4, user.getGoogleSubject());
            ps.setString(5, user.getRole().name());
            ps.setBoolean(6, user.isActive());
            ps.setTimestamp(7, Timestamp.from(user.getCreatedAt() != null ? user.getCreatedAt() : Instant.now()));
            ps.setTimestamp(8, user.getLastLoginAt() != null ? Timestamp.from(user.getLastLoginAt()) : null);
            if (!insert) {
                ps.setInt(9, user.getId());
            }
            if (ps.executeUpdate() == 0) return false;
            if (insert) {
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (keys.next()) user.setId(keys.getInt(1));
                }
            }
            return true;
        } catch (SQLException e) {
            // 23505 = unique_violation: the email or Google account is already registered.
            if (!"23505".equals(e.getSQLState())) {
                LOGGER.log(Level.SEVERE, "Error save user via JDBC: " + e.getMessage(), e);
            }
            return false;
        }
    }

    @FunctionalInterface
    private interface Binder {
        void bind(PreparedStatement ps) throws SQLException;
    }

    private Optional<UserAccount> findOne(String sql, Binder binder) {
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            binder.bind(ps);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return Optional.of(map(rs));
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error reading user via JDBC: " + e.getMessage(), e);
        }
        return Optional.empty();
    }

    private UserAccount map(ResultSet rs) throws SQLException {
        UserAccount user = new UserAccount();
        user.setId(rs.getInt("id"));
        user.setEmail(rs.getString("email"));
        user.setName(rs.getString("name"));
        user.setPasswordHash(rs.getString("password_hash"));
        user.setGoogleSubject(rs.getString("google_subject"));
        try {
            user.setRole(UserRole.valueOf(rs.getString("role").toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException | NullPointerException e) {
            user.setRole(UserRole.CUSTOMER); // an unknown stored role never grants more access
        }
        user.setActive(rs.getBoolean("active"));
        Timestamp created = rs.getTimestamp("created_at");
        if (created != null) user.setCreatedAt(created.toInstant());
        Timestamp lastLogin = rs.getTimestamp("last_login_at");
        if (lastLogin != null) user.setLastLoginAt(lastLogin.toInstant());
        return user;
    }
}
