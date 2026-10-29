package com.dalatcafe.dao;

import com.dalatcafe.model.Voucher;
import com.dalatcafe.model.VoucherType;
import com.dalatcafe.model.VoucherUsage;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Bản cài đặt IVoucherDao bằng JDBC PostgreSQL. Giữ lượt khóa dòng voucher (SELECT ... FOR
 * UPDATE) trong một transaction, nên các lượt cùng mã chạy lần lượt và không vượt giới hạn. Lỗi
 * đọc ném IllegalStateException thay vì trả "không có mã", để checkout không âm thầm bỏ giảm giá.
 */
public class JdbcVoucherDao implements IVoucherDao {
    private static final Logger LOGGER = Logger.getLogger(JdbcVoucherDao.class.getName());
    private static final String COLUMNS = "id, code, type, value, max_discount, min_order, max_uses, per_account_limit, "
            + "first_online_order_only, start_date, end_date, description, active, used_count, created_at";
    private static final String USAGE_COLUMNS = "id, voucher_id, user_id, order_code, discount_amount, created_at";

    @FunctionalInterface
    private interface Work<T> {
        T run(Connection conn) throws SQLException;
    }

    private static <T> T read(String what, Work<T> work) {
        try (Connection conn = JdbcDatabase.getConnection()) {
            return work.run(conn);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not read " + what + ": " + e.getMessage(), e);
        }
    }

    /** Chạy trong một transaction; lỗi thì rollback và trả về fallback. */
    private static <T> T inTransaction(String what, T fallback, Work<T> work) {
        try (Connection conn = JdbcDatabase.getConnection()) {
            boolean autoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                T result = work.run(conn);
                conn.commit();
                return result;
            } catch (SQLException | RuntimeException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(autoCommit);
            }
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Error while " + what + " via JDBC: " + e.getMessage(), e);
            return fallback;
        }
    }

    @Override
    public List<Voucher> findAll() {
        return read("vouchers", conn -> {
            try (PreparedStatement ps = conn.prepareStatement("SELECT " + COLUMNS + " FROM vouchers ORDER BY id");
                 ResultSet rs = ps.executeQuery()) {
                List<Voucher> vouchers = new ArrayList<>();
                while (rs.next()) vouchers.add(map(rs));
                return vouchers;
            }
        });
    }

    @Override
    public Optional<Voucher> findById(int id) {
        return read("voucher " + id, conn -> findOne(conn, "SELECT " + COLUMNS + " FROM vouchers WHERE id = ?", id));
    }

    @Override
    public Optional<Voucher> findByCode(String code) {
        if (code == null) return Optional.empty();
        return read("voucher " + code, conn ->
                findOne(conn, "SELECT " + COLUMNS + " FROM vouchers WHERE UPPER(code) = UPPER(?)", code.trim()));
    }

    private static Optional<Voucher> findOne(Connection conn, String sql, Object key) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, key);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        }
    }

    @Override
    public boolean save(Voucher voucher) {
        if (voucher == null || voucher.getCode() == null) return false;
        return inTransaction("saving voucher " + voucher.getCode(), false, conn -> {
            try (PreparedStatement dup = conn.prepareStatement(
                    "SELECT 1 FROM vouchers WHERE UPPER(code) = UPPER(?) AND id IS DISTINCT FROM ?")) {
                dup.setString(1, voucher.getCode());
                dup.setObject(2, voucher.getId(), Types.INTEGER);
                try (ResultSet rs = dup.executeQuery()) {
                    if (rs.next()) return false;
                }
            }
            if (voucher.getId() == null) {
                String sql = "INSERT INTO vouchers (code, type, value, max_discount, min_order, max_uses, per_account_limit, "
                        + "first_online_order_only, start_date, end_date, description, active) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    bindFields(ps, voucher);
                    try (ResultSet rs = ps.executeQuery()) {
                        rs.next();
                        voucher.setId(rs.getInt(1));
                        voucher.setUsedCount(0);
                    }
                }
                return true;
            }
            String sql = "UPDATE vouchers SET code = ?, type = ?, value = ?, max_discount = ?, min_order = ?, max_uses = ?, "
                    + "per_account_limit = ?, first_online_order_only = ?, start_date = ?, end_date = ?, description = ?, "
                    + "active = ? WHERE id = ?";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                bindFields(ps, voucher);
                ps.setInt(13, voucher.getId());
                return ps.executeUpdate() == 1;
            }
        });
    }

    private static void bindFields(PreparedStatement ps, Voucher v) throws SQLException {
        ps.setString(1, v.getCode());
        ps.setString(2, v.getType().name());
        ps.setDouble(3, v.getValue());
        ps.setObject(4, v.getMaxDiscount(), Types.NUMERIC);
        ps.setDouble(5, v.getMinOrder());
        ps.setObject(6, v.getMaxUses(), Types.INTEGER);
        ps.setObject(7, v.getPerAccountLimit(), Types.INTEGER);
        ps.setBoolean(8, v.isFirstOnlineOrderOnly());
        ps.setDate(9, Date.valueOf(v.getStartDate()));
        ps.setDate(10, Date.valueOf(v.getEndDate()));
        ps.setString(11, v.getDescription());
        ps.setBoolean(12, v.isActive());
    }

    @Override
    public boolean deleteById(int id) {
        return inTransaction("deleting voucher " + id, false, conn -> {
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM vouchers WHERE id = ?")) {
                ps.setInt(1, id);
                return ps.executeUpdate() == 1;
            }
        });
    }

    @Override
    public RedeemResult redeem(int voucherId, Integer userId, String orderCode, double discountAmount) {
        RedeemResult failed = new RedeemResult(RedeemStatus.UNKNOWN_VOUCHER, 0);
        return inTransaction("redeeming voucher " + voucherId, failed, conn -> {
            Integer maxUses;
            Integer perAccount;
            int used;
            try (PreparedStatement lock = conn.prepareStatement(
                    "SELECT max_uses, per_account_limit, used_count FROM vouchers WHERE id = ? FOR UPDATE")) {
                lock.setInt(1, voucherId);
                try (ResultSet rs = lock.executeQuery()) {
                    if (!rs.next()) return failed;
                    maxUses = (Integer) rs.getObject("max_uses");
                    perAccount = (Integer) rs.getObject("per_account_limit");
                    used = rs.getInt("used_count");
                }
            }
            if (maxUses != null && used >= maxUses) return new RedeemResult(RedeemStatus.SOLD_OUT, 0);
            if (userId != null && perAccount != null && countUsages(conn, voucherId, userId) >= perAccount) {
                return new RedeemResult(RedeemStatus.ACCOUNT_LIMIT, 0);
            }
            int usageId;
            try (PreparedStatement insert = conn.prepareStatement(
                    "INSERT INTO voucher_usages (voucher_id, user_id, order_code, discount_amount) VALUES (?, ?, ?, ?) RETURNING id")) {
                insert.setInt(1, voucherId);
                insert.setObject(2, userId, Types.INTEGER);
                insert.setString(3, orderCode);
                insert.setDouble(4, discountAmount);
                try (ResultSet rs = insert.executeQuery()) {
                    rs.next();
                    usageId = rs.getInt(1);
                }
            }
            try (PreparedStatement bump = conn.prepareStatement("UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?")) {
                bump.setInt(1, voucherId);
                bump.executeUpdate();
            }
            return new RedeemResult(RedeemStatus.REDEEMED, usageId);
        });
    }

    @Override
    public boolean attachOrder(int usageId, String orderCode) {
        return inTransaction("attaching order to voucher usage " + usageId, false, conn -> {
            try (PreparedStatement ps = conn.prepareStatement("UPDATE voucher_usages SET order_code = ? WHERE id = ?")) {
                ps.setString(1, orderCode);
                ps.setInt(2, usageId);
                return ps.executeUpdate() == 1;
            }
        });
    }

    @Override
    public boolean releaseUsage(int usageId) {
        return release("DELETE FROM voucher_usages WHERE id = ? RETURNING voucher_id", usageId);
    }

    @Override
    public boolean releaseByOrder(String orderCode) {
        if (orderCode == null) return false;
        return release("DELETE FROM voucher_usages WHERE UPPER(order_code) = UPPER(?) RETURNING voucher_id", orderCode);
    }

    private boolean release(String deleteSql, Object key) {
        return inTransaction("releasing voucher usage " + key, false, conn -> {
            List<Integer> voucherIds = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement(deleteSql)) {
                ps.setObject(1, key);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) voucherIds.add(rs.getInt(1));
                }
            }
            for (int voucherId : voucherIds) {
                try (PreparedStatement ps = conn.prepareStatement(
                        "UPDATE vouchers SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?")) {
                    ps.setInt(1, voucherId);
                    ps.executeUpdate();
                }
            }
            return !voucherIds.isEmpty();
        });
    }

    @Override
    public Optional<VoucherUsage> findUsageByOrder(String orderCode) {
        if (orderCode == null) return Optional.empty();
        return read("voucher usage of " + orderCode, conn -> {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT " + USAGE_COLUMNS + " FROM voucher_usages WHERE UPPER(order_code) = UPPER(?)")) {
                ps.setString(1, orderCode);
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next() ? Optional.of(mapUsage(rs)) : Optional.empty();
                }
            }
        });
    }

    @Override
    public List<VoucherUsage> findUsages(int voucherId) {
        return read("usages of voucher " + voucherId, conn -> {
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT " + USAGE_COLUMNS + " FROM voucher_usages WHERE voucher_id = ? ORDER BY id")) {
                ps.setInt(1, voucherId);
                try (ResultSet rs = ps.executeQuery()) {
                    List<VoucherUsage> usages = new ArrayList<>();
                    while (rs.next()) usages.add(mapUsage(rs));
                    return usages;
                }
            }
        });
    }

    @Override
    public int countUsages(int voucherId, int userId) {
        return read("usages of voucher " + voucherId, conn -> countUsages(conn, voucherId, userId));
    }

    private static int countUsages(Connection conn, int voucherId, int userId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COUNT(*) FROM voucher_usages WHERE voucher_id = ? AND user_id = ?")) {
            ps.setInt(1, voucherId);
            ps.setInt(2, userId);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getInt(1);
            }
        }
    }

    private static Voucher map(ResultSet rs) throws SQLException {
        Voucher v = new Voucher();
        v.setId(rs.getInt("id"));
        v.setCode(rs.getString("code"));
        v.setType(VoucherType.valueOf(rs.getString("type")));
        v.setValue(rs.getDouble("value"));
        java.math.BigDecimal maxDiscount = rs.getBigDecimal("max_discount");
        v.setMaxDiscount(maxDiscount == null ? null : maxDiscount.doubleValue());
        v.setMinOrder(rs.getDouble("min_order"));
        v.setMaxUses((Integer) rs.getObject("max_uses"));
        v.setPerAccountLimit((Integer) rs.getObject("per_account_limit"));
        v.setFirstOnlineOrderOnly(rs.getBoolean("first_online_order_only"));
        v.setStartDate(rs.getDate("start_date").toLocalDate());
        v.setEndDate(rs.getDate("end_date").toLocalDate());
        v.setDescription(rs.getString("description"));
        v.setActive(rs.getBoolean("active"));
        v.setUsedCount(rs.getInt("used_count"));
        Timestamp created = rs.getTimestamp("created_at");
        v.setCreatedAt(created == null ? Instant.now() : created.toInstant());
        return v;
    }

    private static VoucherUsage mapUsage(ResultSet rs) throws SQLException {
        Timestamp created = rs.getTimestamp("created_at");
        return new VoucherUsage(rs.getInt("id"), rs.getInt("voucher_id"), (Integer) rs.getObject("user_id"),
                rs.getString("order_code"), rs.getDouble("discount_amount"),
                created == null ? Instant.now() : created.toInstant());
    }
}
