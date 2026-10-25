package com.dalatcafe.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * JDBC PostgreSQL implementation of IConfigDao (table {@code store_config}, one row per setting).
 * All settings of one save are written in a single transaction, so a restart never reads half of
 * an update.
 */
public class JdbcConfigDao implements IConfigDao {
    private static final Logger LOGGER = Logger.getLogger(JdbcConfigDao.class.getName());

    @Override
    public Map<String, String> loadAll() {
        Map<String, String> values = new LinkedHashMap<>();
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT config_key, config_value FROM store_config ORDER BY config_key");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                values.put(rs.getString("config_key"), rs.getString("config_value"));
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error loading store settings via JDBC: " + e.getMessage(), e);
        }
        return values;
    }

    @Override
    public boolean saveAll(Map<String, String> values) {
        Objects.requireNonNull(values, "Values must not be null");
        String sql = "INSERT INTO store_config (config_key, config_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) "
                + "ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = CURRENT_TIMESTAMP";
        try (Connection conn = JdbcDatabase.getConnection()) {
            boolean autoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                for (Map.Entry<String, String> entry : values.entrySet()) {
                    ps.setString(1, entry.getKey());
                    ps.setString(2, entry.getValue());
                    ps.addBatch();
                }
                ps.executeBatch();
                conn.commit();
                return true;
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(autoCommit);
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error saving store settings via JDBC: " + e.getMessage(), e);
            return false;
        }
    }
}
