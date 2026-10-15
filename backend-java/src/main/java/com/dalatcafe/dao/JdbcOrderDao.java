package com.dalatcafe.dao;

import com.dalatcafe.model.*;

import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * JDBC PostgreSQL implementation of IOrderDao.
 */
public class JdbcOrderDao implements IOrderDao {
    private static final Logger LOGGER = Logger.getLogger(JdbcOrderDao.class.getName());

    @Override
    public List<Order> findAll() {
        List<Order> list = new ArrayList<>();
        String sql = "SELECT id, order_code, customer, table_id, order_type, subtotal, vat_amount, discount_amount, total, payment_method, payment_status, status, note, created_at, completed_at FROM orders ORDER BY created_at DESC";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(mapResultSetToOrder(rs));
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findAll orders via JDBC: " + e.getMessage(), e);
        }
        return list;
    }

    @Override
    public Optional<Order> findById(int id) {
        String sql = "SELECT id, order_code, customer, table_id, order_type, subtotal, vat_amount, discount_amount, total, payment_method, payment_status, status, note, created_at, completed_at FROM orders WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapResultSetToOrder(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findById order via JDBC: " + e.getMessage(), e);
        }
        return Optional.empty();
    }

    @Override
    public Optional<Order> findByOrderCode(String orderCode) {
        if (orderCode == null) return Optional.empty();
        String sql = "SELECT id, order_code, customer, table_id, order_type, subtotal, vat_amount, discount_amount, total, payment_method, payment_status, status, note, created_at, completed_at FROM orders WHERE LOWER(order_code) = LOWER(?)";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, orderCode);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapResultSetToOrder(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findByOrderCode via JDBC: " + e.getMessage(), e);
        }
        return Optional.empty();
    }

    @Override
    public List<Order> findByStatus(OrderStatus status) {
        List<Order> list = new ArrayList<>();
        if (status == null) return list;
        String sql = "SELECT id, order_code, customer, table_id, order_type, subtotal, vat_amount, discount_amount, total, payment_method, payment_status, status, note, created_at, completed_at FROM orders WHERE UPPER(status) = ? ORDER BY created_at DESC";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status.name());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapResultSetToOrder(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findByStatus orders via JDBC: " + e.getMessage(), e);
        }
        return list;
    }

    @Override
    public List<Order> findByTableId(int tableId) {
        List<Order> list = new ArrayList<>();
        String sql = "SELECT id, order_code, customer, table_id, order_type, subtotal, vat_amount, discount_amount, total, payment_method, payment_status, status, note, created_at, completed_at FROM orders WHERE table_id = ? ORDER BY created_at DESC";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, tableId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapResultSetToOrder(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findByTableId orders via JDBC: " + e.getMessage(), e);
        }
        return list;
    }

    @Override
    public boolean save(Order order) {
        if (order == null) return false;
        if (order.getId() != null && order.getId() > 0) {
            String sql = """
                INSERT INTO orders (id, order_code, customer, table_id, order_type, subtotal, vat_amount, discount_amount, total, payment_method, payment_status, status, note, created_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    order_code = EXCLUDED.order_code,
                    customer = EXCLUDED.customer,
                    table_id = EXCLUDED.table_id,
                    order_type = EXCLUDED.order_type,
                    subtotal = EXCLUDED.subtotal,
                    vat_amount = EXCLUDED.vat_amount,
                    discount_amount = EXCLUDED.discount_amount,
                    total = EXCLUDED.total,
                    payment_method = EXCLUDED.payment_method,
                    payment_status = EXCLUDED.payment_status,
                    status = EXCLUDED.status,
                    note = EXCLUDED.note,
                    completed_at = EXCLUDED.completed_at
            """;
            try (Connection conn = JdbcDatabase.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql)) {
                fillOrderPreparedStatement(ps, order, order.getId());
                return ps.executeUpdate() > 0;
            } catch (SQLException e) {
                LOGGER.log(Level.SEVERE, "Error save existing order via JDBC: " + e.getMessage(), e);
                return false;
            }
        } else {
            String sql = """
                INSERT INTO orders (order_code, customer, table_id, order_type, subtotal, vat_amount, discount_amount, total, payment_method, payment_status, status, note, created_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;
            try (Connection conn = JdbcDatabase.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                String code = order.getOrderCode();
                if (code == null || code.isBlank()) {
                    code = "AC-" + (System.currentTimeMillis() % 10000);
                    order.setOrderCode(code);
                }
                ps.setString(1, code);
                ps.setString(2, order.getCustomer());
                if (order.getTableId() != null) {
                    ps.setInt(3, order.getTableId());
                } else {
                    ps.setNull(3, Types.INTEGER);
                }
                ps.setString(4, order.getOrderType() != null ? order.getOrderType().name() : OrderType.DINE_IN.name());
                ps.setDouble(5, order.getSubtotal());
                ps.setDouble(6, order.getVatAmount());
                ps.setDouble(7, order.getDiscountAmount());
                ps.setDouble(8, order.getTotal());
                ps.setString(9, order.getPaymentMethod() != null ? order.getPaymentMethod().name() : PaymentMethod.CASH.name());
                ps.setString(10, order.getPaymentStatus() != null ? order.getPaymentStatus().name() : PaymentStatus.UNPAID.name());
                ps.setString(11, order.getStatus() != null ? order.getStatus().name() : OrderStatus.PENDING.name());
                ps.setString(12, order.getNote());
                ps.setTimestamp(13, Timestamp.from(order.getCreatedAt() != null ? order.getCreatedAt() : Instant.now()));
                ps.setTimestamp(14, order.getCompletedAt() != null ? Timestamp.from(order.getCompletedAt()) : null);

                int rows = ps.executeUpdate();
                if (rows > 0) {
                    try (ResultSet keys = ps.getGeneratedKeys()) {
                        if (keys.next()) {
                            order.setId(keys.getInt(1));
                        }
                    }
                    return true;
                }
            } catch (SQLException e) {
                LOGGER.log(Level.SEVERE, "Error insert order via JDBC: " + e.getMessage(), e);
            }
            return false;
        }
    }

    private void fillOrderPreparedStatement(PreparedStatement ps, Order order, int id) throws SQLException {
        ps.setInt(1, id);
        ps.setString(2, order.getOrderCode());
        ps.setString(3, order.getCustomer());
        if (order.getTableId() != null) {
            ps.setInt(4, order.getTableId());
        } else {
            ps.setNull(4, Types.INTEGER);
        }
        ps.setString(5, order.getOrderType() != null ? order.getOrderType().name() : OrderType.DINE_IN.name());
        ps.setDouble(6, order.getSubtotal());
        ps.setDouble(7, order.getVatAmount());
        ps.setDouble(8, order.getDiscountAmount());
        ps.setDouble(9, order.getTotal());
        ps.setString(10, order.getPaymentMethod() != null ? order.getPaymentMethod().name() : PaymentMethod.CASH.name());
        ps.setString(11, order.getPaymentStatus() != null ? order.getPaymentStatus().name() : PaymentStatus.UNPAID.name());
        ps.setString(12, order.getStatus() != null ? order.getStatus().name() : OrderStatus.PENDING.name());
        ps.setString(13, order.getNote());
        ps.setTimestamp(14, Timestamp.from(order.getCreatedAt() != null ? order.getCreatedAt() : Instant.now()));
        ps.setTimestamp(15, order.getCompletedAt() != null ? Timestamp.from(order.getCompletedAt()) : null);
    }

    @Override
    public boolean updateStatus(int id, OrderStatus status) {
        String sql = "UPDATE orders SET status = ?, completed_at = CASE WHEN ? = 'COMPLETED' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            String statusName = status != null ? status.name() : OrderStatus.PENDING.name();
            ps.setString(1, statusName);
            ps.setString(2, statusName);
            ps.setInt(3, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error updateStatus order via JDBC: " + e.getMessage(), e);
            return false;
        }
    }

    @Override
    public boolean updatePaymentStatus(int id, PaymentStatus paymentStatus) {
        String sql = "UPDATE orders SET payment_status = ? WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, paymentStatus != null ? paymentStatus.name() : PaymentStatus.UNPAID.name());
            ps.setInt(2, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error updatePaymentStatus order via JDBC: " + e.getMessage(), e);
            return false;
        }
    }

    @Override
    public boolean deleteById(int id) {
        String sql = "DELETE FROM orders WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error deleteById order via JDBC: " + e.getMessage(), e);
            return false;
        }
    }

    private Order mapResultSetToOrder(ResultSet rs) throws SQLException {
        Order order = new Order();
        order.setId(rs.getInt("id"));
        order.setOrderCode(rs.getString("order_code"));
        order.setCustomer(rs.getString("customer"));

        int tableId = rs.getInt("table_id");
        if (!rs.wasNull()) {
            order.setTableId(tableId);
        }

        String typeStr = rs.getString("order_type");
        if (typeStr != null) {
            try {
                order.setOrderType(OrderType.valueOf(typeStr.toUpperCase().replace("-", "_")));
            } catch (IllegalArgumentException e) {
                order.setOrderType(OrderType.DINE_IN);
            }
        }

        order.setSubtotal(rs.getDouble("subtotal"));
        order.setVatAmount(rs.getDouble("vat_amount"));
        order.setDiscountAmount(rs.getDouble("discount_amount"));
        order.setTotal(rs.getDouble("total"));

        String payMethod = rs.getString("payment_method");
        if (payMethod != null) {
            try {
                order.setPaymentMethod(PaymentMethod.valueOf(payMethod.toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }

        String payStatus = rs.getString("payment_status");
        if (payStatus != null) {
            try {
                order.setPaymentStatus(PaymentStatus.valueOf(payStatus.toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }

        String statusStr = rs.getString("status");
        if (statusStr != null) {
            try {
                order.setStatus(OrderStatus.valueOf(statusStr.toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }

        order.setNote(rs.getString("note"));

        Timestamp created = rs.getTimestamp("created_at");
        if (created != null) {
            order.setCreatedAt(created.toInstant());
        }
        Timestamp completed = rs.getTimestamp("completed_at");
        if (completed != null) {
            order.setCompletedAt(completed.toInstant());
        }
        return order;
    }
}

