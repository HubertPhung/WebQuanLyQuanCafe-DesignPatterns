package com.dalatcafe.dao;

import com.dalatcafe.model.MenuItem;

import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * JDBC PostgreSQL implementation of IMenuDao.
 */
public class JdbcMenuDao implements IMenuDao {
    private static final Logger LOGGER = Logger.getLogger(JdbcMenuDao.class.getName());

    @Override
    public List<MenuItem> findAll() {
        List<MenuItem> list = new ArrayList<>();
        String sql = "SELECT id, name, category, kind, unit, cost_price, sell_price, in_stock, recipe, image_url, created_at, variations FROM menu_items ORDER BY id ASC";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(mapResultSetToMenuItem(rs));
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findAll menu_items via JDBC: " + e.getMessage(), e);
        }
        return list;
    }

    @Override
    public Optional<MenuItem> findById(int id) {
        String sql = "SELECT id, name, category, kind, unit, cost_price, sell_price, in_stock, recipe, image_url, created_at, variations FROM menu_items WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapResultSetToMenuItem(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findById menu_item via JDBC: " + e.getMessage(), e);
        }
        return Optional.empty();
    }

    @Override
    public List<MenuItem> findByCategory(String category) {
        List<MenuItem> list = new ArrayList<>();
        if (category == null) return list;
        String sql = "SELECT id, name, category, kind, unit, cost_price, sell_price, in_stock, recipe, image_url, created_at, variations FROM menu_items WHERE LOWER(category) = LOWER(?) ORDER BY id ASC";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, category);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapResultSetToMenuItem(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findByCategory menu_items via JDBC: " + e.getMessage(), e);
        }
        return list;
    }

    @Override
    public boolean save(MenuItem item) {
        if (item == null) return false;
        if (item.getId() != null && item.getId() > 0) {
            String sql = """
                INSERT INTO menu_items (id, name, category, kind, unit, cost_price, sell_price, in_stock, recipe, image_url, created_at, variations)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB))
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    kind = EXCLUDED.kind,
                    unit = EXCLUDED.unit,
                    cost_price = EXCLUDED.cost_price,
                    sell_price = EXCLUDED.sell_price,
                    in_stock = EXCLUDED.in_stock,
                    recipe = EXCLUDED.recipe,
                    image_url = EXCLUDED.image_url,
                    variations = EXCLUDED.variations
            """;
            try (Connection conn = JdbcDatabase.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql)) {
                fillPreparedStatement(ps, item, item.getId());
                return ps.executeUpdate() > 0;
            } catch (SQLException e) {
                LOGGER.log(Level.SEVERE, "Error save existing menu_item via JDBC: " + e.getMessage(), e);
                return false;
            }
        } else {
            String sql = """
                INSERT INTO menu_items (name, category, kind, unit, cost_price, sell_price, in_stock, recipe, image_url, created_at, variations)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSONB))
            """;
            try (Connection conn = JdbcDatabase.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, item.getName());
                ps.setString(2, item.getCategory());
                ps.setString(3, item.getKind());
                ps.setString(4, item.getUnit());
                ps.setDouble(5, item.getCostPrice());
                ps.setDouble(6, item.getSellPrice());
                ps.setBoolean(7, item.isInStock());
                ps.setString(8, item.getRecipe());
                ps.setString(9, item.getImageUrl());
                ps.setTimestamp(10, Timestamp.from(Instant.now()));
                ps.setString(11, JsonColumns.fromVariations(item.getVariations()));
                int rows = ps.executeUpdate();
                if (rows > 0) {
                    try (ResultSet keys = ps.getGeneratedKeys()) {
                        if (keys.next()) {
                            item.setId(keys.getInt(1));
                        }
                    }
                    return true;
                }
            } catch (SQLException e) {
                LOGGER.log(Level.SEVERE, "Error insert new menu_item via JDBC: " + e.getMessage(), e);
            }
            return false;
        }
    }

    private void fillPreparedStatement(PreparedStatement ps, MenuItem item, int id) throws SQLException {
        ps.setInt(1, id);
        ps.setString(2, item.getName());
        ps.setString(3, item.getCategory());
        ps.setString(4, item.getKind());
        ps.setString(5, item.getUnit());
        ps.setDouble(6, item.getCostPrice());
        ps.setDouble(7, item.getSellPrice());
        ps.setBoolean(8, item.isInStock());
        ps.setString(9, item.getRecipe());
        ps.setString(10, item.getImageUrl());
        ps.setTimestamp(11, Timestamp.from(item.getCreatedAt() != null ? item.getCreatedAt() : Instant.now()));
        ps.setString(12, JsonColumns.fromVariations(item.getVariations()));
    }

    @Override
    public boolean toggleInStock(int id, boolean inStock) {
        String sql = "UPDATE menu_items SET in_stock = ? WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setBoolean(1, inStock);
            ps.setInt(2, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error toggleInStock via JDBC: " + e.getMessage(), e);
            return false;
        }
    }

    @Override
    public boolean deleteById(int id) {
        String sql = "DELETE FROM menu_items WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error deleteById menu_item via JDBC: " + e.getMessage(), e);
            return false;
        }
    }

    private MenuItem mapResultSetToMenuItem(ResultSet rs) throws SQLException {
        MenuItem item = new MenuItem();
        item.setId(rs.getInt("id"));
        item.setName(rs.getString("name"));
        item.setCategory(rs.getString("category"));
        item.setKind(rs.getString("kind"));
        item.setUnit(rs.getString("unit"));
        item.setCostPrice(rs.getDouble("cost_price"));
        item.setSellPrice(rs.getDouble("sell_price"));
        item.setInStock(rs.getBoolean("in_stock"));
        item.setRecipe(rs.getString("recipe"));
        item.setImageUrl(rs.getString("image_url"));
        item.setVariations(JsonColumns.toVariations(rs.getString("variations")));

        Timestamp createdAt = rs.getTimestamp("created_at");
        if (createdAt != null) {
            item.setCreatedAt(createdAt.toInstant());
        }
        return item;
    }
}

