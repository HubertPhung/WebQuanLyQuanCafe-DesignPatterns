package com.dalatcafe.dao;

import com.dalatcafe.model.Customer;
import com.dalatcafe.model.CustomerRank;

import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * JDBC PostgreSQL implementation of ICustomerDao.
 */
public class JdbcCustomerDao implements ICustomerDao {
    private static final Logger LOGGER = Logger.getLogger(JdbcCustomerDao.class.getName());

    @Override
    public List<Customer> findAll() {
        List<Customer> list = new ArrayList<>();
        String sql = "SELECT id, name, phone, email, total_orders, total_spent, loyalty_points, rank, last_visit FROM customers ORDER BY total_spent DESC";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(mapResultSetToCustomer(rs));
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findAll customers via JDBC: " + e.getMessage(), e);
        }
        return list;
    }

    @Override
    public Optional<Customer> findById(int id) {
        String sql = "SELECT id, name, phone, email, total_orders, total_spent, loyalty_points, rank, last_visit FROM customers WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapResultSetToCustomer(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findById customer via JDBC: " + e.getMessage(), e);
        }
        return Optional.empty();
    }

    @Override
    public Optional<Customer> findByPhone(String phone) {
        if (phone == null) return Optional.empty();
        String sql = "SELECT id, name, phone, email, total_orders, total_spent, loyalty_points, rank, last_visit FROM customers WHERE phone = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, phone);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapResultSetToCustomer(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findByPhone customer via JDBC: " + e.getMessage(), e);
        }
        return Optional.empty();
    }

    @Override
    public List<Customer> findByRank(CustomerRank rank) {
        List<Customer> list = new ArrayList<>();
        if (rank == null) return list;
        String sql = "SELECT id, name, phone, email, total_orders, total_spent, loyalty_points, rank, last_visit FROM customers WHERE UPPER(rank) = ? ORDER BY total_spent DESC";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, rank.name());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapResultSetToCustomer(rs));
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error findByRank customers via JDBC: " + e.getMessage(), e);
        }
        return list;
    }

    @Override
    public boolean save(Customer customer) {
        if (customer == null) return false;
        if (customer.getId() != null && customer.getId() > 0) {
            String sql = """
                INSERT INTO customers (id, name, phone, email, total_orders, total_spent, loyalty_points, rank, last_visit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    phone = EXCLUDED.phone,
                    email = EXCLUDED.email,
                    total_orders = EXCLUDED.total_orders,
                    total_spent = EXCLUDED.total_spent,
                    loyalty_points = EXCLUDED.loyalty_points,
                    rank = EXCLUDED.rank,
                    last_visit = EXCLUDED.last_visit
            """;
            try (Connection conn = JdbcDatabase.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql)) {
                fillCustomerPreparedStatement(ps, customer, customer.getId());
                return ps.executeUpdate() > 0;
            } catch (SQLException e) {
                LOGGER.log(Level.SEVERE, "Error save existing customer via JDBC: " + e.getMessage(), e);
                return false;
            }
        } else {
            String sql = """
                INSERT INTO customers (name, phone, email, total_orders, total_spent, loyalty_points, rank, last_visit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """;
            try (Connection conn = JdbcDatabase.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, customer.getName());
                ps.setString(2, customer.getPhone());
                ps.setString(3, customer.getEmail());
                ps.setInt(4, customer.getTotalOrders());
                ps.setDouble(5, customer.getTotalSpent());
                ps.setInt(6, customer.getLoyaltyPoints());
                ps.setString(7, customer.getRank() != null ? customer.getRank().name() : CustomerRank.BRONZE.name());
                ps.setTimestamp(8, Timestamp.from(customer.getLastVisit() != null ? customer.getLastVisit() : Instant.now()));

                int rows = ps.executeUpdate();
                if (rows > 0) {
                    try (ResultSet keys = ps.getGeneratedKeys()) {
                        if (keys.next()) {
                            customer.setId(keys.getInt(1));
                        }
                    }
                    return true;
                }
            } catch (SQLException e) {
                LOGGER.log(Level.SEVERE, "Error insert new customer via JDBC: " + e.getMessage(), e);
            }
            return false;
        }
    }

    private void fillCustomerPreparedStatement(PreparedStatement ps, Customer customer, int id) throws SQLException {
        ps.setInt(1, id);
        ps.setString(2, customer.getName());
        ps.setString(3, customer.getPhone());
        ps.setString(4, customer.getEmail());
        ps.setInt(5, customer.getTotalOrders());
        ps.setDouble(6, customer.getTotalSpent());
        ps.setInt(7, customer.getLoyaltyPoints());
        ps.setString(8, customer.getRank() != null ? customer.getRank().name() : CustomerRank.BRONZE.name());
        ps.setTimestamp(9, Timestamp.from(customer.getLastVisit() != null ? customer.getLastVisit() : Instant.now()));
    }

    @Override
    public boolean addOrderRecord(int id, double orderAmount, int earnedPoints) {
        Optional<Customer> opt = findById(id);
        if (opt.isEmpty()) return false;
        Customer c = opt.get();
        c.addOrderRecord(orderAmount, earnedPoints);
        return save(c);
    }

    @Override
    public boolean redeemPoints(int id, int points) {
        Optional<Customer> opt = findById(id);
        if (opt.isEmpty()) return false;
        Customer c = opt.get();
        if (c.redeemPoints(points)) {
            return save(c);
        }
        return false;
    }

    @Override
    public boolean deleteById(int id) {
        String sql = "DELETE FROM customers WHERE id = ?";
        try (Connection conn = JdbcDatabase.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error deleteById customer via JDBC: " + e.getMessage(), e);
            return false;
        }
    }

    private Customer mapResultSetToCustomer(ResultSet rs) throws SQLException {
        Customer c = new Customer();
        c.setId(rs.getInt("id"));
        c.setName(rs.getString("name"));
        c.setPhone(rs.getString("phone"));
        c.setEmail(rs.getString("email"));
        c.setTotalOrders(rs.getInt("total_orders"));
        c.setTotalSpent(rs.getDouble("total_spent"));
        c.setLoyaltyPoints(rs.getInt("loyalty_points"));

        String rankStr = rs.getString("rank");
        if (rankStr != null) {
            try {
                c.setRank(CustomerRank.valueOf(rankStr.toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }

        Timestamp visit = rs.getTimestamp("last_visit");
        if (visit != null) {
            c.setLastVisit(visit.toInstant());
        }
        return c;
    }
}
