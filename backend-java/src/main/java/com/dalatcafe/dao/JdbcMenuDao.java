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
        String sql = "SELECT id, name, category, kind, stock_qty, unit, low_stock_threshold, cost_price, sell_price, in_stock, recipe, image_url, created_at FROM menu_items ORDER BY id ASC";
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
        String sql = "SELECT id, name, category, kind, stock_qty, unit, low_stock_threshold, cost_price, sell_price, in_stock, recipe, image_url, created_at FROM menu_items WHERE id = ?";
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
        String sql = "SELECT id, name, category, kind, stock_qty, unit, low_stock_threshold, cost_price, sell_price, in_stock, recipe, image_url, created_at FROM menu_items WHERE LOWER(category) = LOWER(?) ORDER BY id ASC";
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
    public List<MenuItem> findLowStockItems() {
        List<MenuItem> list = new ArrayList<>();
        String sql = "SELECT id, name, category, kind, stock_qty, unit, low_stock_threshold, cost_price, sell_price, in_stock, recipe, image_url, created_at FROM menu_items WHERE stock_qty <= low_stock_threshold ORDER BY stock_qty ASC";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(mapResultSetToMenuItem(rs));
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findLowStockItems via JDBC: " + e.getMessage(), e);
        }
        return list;
    }

    @Override
    public boolean save(MenuItem item) {
        if (item == null) return false;
        if (item.getId() != null && item.getId() > 0) {
            String sql = """
                INSERT INTO menu_items (id, name, category, kind, stock_qty, unit, low_stock_threshold, cost_price, sell_price, in_stock, recipe, image_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    kind = EXCLUDED.kind,
                    stock_qty = EXCLUDED.stock_qty,
                    unit = EXCLUDED.unit,
                    low_stock_threshold = EXCLUDED.low_stock_threshold,
                    cost_price = EXCLUDED.cost_price,
                    sell_price = EXCLUDED.sell_price,
                    in_stock = EXCLUDED.in_stock,
                    recipe = EXCLUDED.recipe,
                    image_url = EXCLUDED.image_url
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
                INSERT INTO menu_items (name, category, kind, stock_qty, unit, low_stock_threshold, cost_price, sell_price, in_stock, recipe, image_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;
            try (Connection conn = JdbcDatabase.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, item.getName());
                ps.setString(2, item.getCategory());
                ps.setString(3, item.getKind());
                ps.setDouble(4, item.getStockQty());
                ps.setString(5, item.getUnit());
                ps.setDouble(6, item.getLowStockThreshold());
                ps.setDouble(7, item.getCostPrice());
                ps.setDouble(8, item.getSellPrice());
                ps.setBoolean(9, item.isInStock());
                ps.setString(10, item.getRecipe());
                ps.setString(11, item.getImageUrl());
                ps.setTimestamp(12, Timestamp.from(Instant.now()));
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
        ps.setDouble(5, item.getStockQty());
        ps.setString(6, item.getUnit());
        ps.setDouble(7, item.getLowStockThreshold());
        ps.setDouble(8, item.getCostPrice());
        ps.setDouble(9, item.getSellPrice());
        ps.setBoolean(10, item.isInStock());
        ps.setString(11, item.getRecipe());
        ps.setString(12, item.getImageUrl());
        ps.setTimestamp(13, Timestamp.from(item.getCreatedAt() != null ? item.getCreatedAt() : Instant.now()));
    }

    @Override
    public boolean updateStock(int id, double quantityChange) {
        String sql = "UPDATE menu_items SET stock_qty = GREATEST(0.0, stock_qty + ?) WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setDouble(1, quantityChange);
            ps.setInt(2, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error updateStock via JDBC: " + e.getMessage(), e);
            return false;
        }
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
        item.setStockQty(rs.getDouble("stock_qty"));
        item.setUnit(rs.getString("unit"));
        item.setLowStockThreshold(rs.getDouble("low_stock_threshold"));
        item.setCostPrice(rs.getDouble("cost_price"));
        item.setSellPrice(rs.getDouble("sell_price"));
        item.setInStock(rs.getBoolean("in_stock"));
        item.setRecipe(rs.getString("recipe"));
        item.setImageUrl(rs.getString("image_url"));

        Timestamp createdAt = rs.getTimestamp("created_at");
        if (createdAt != null) {
            item.setCreatedAt(createdAt.toInstant());
        }
        return item;
    }
}
