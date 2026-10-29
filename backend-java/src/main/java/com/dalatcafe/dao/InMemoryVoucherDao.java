package com.dalatcafe.dao;

import com.dalatcafe.model.Voucher;
import com.dalatcafe.model.VoucherUsage;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Bản cài đặt IVoucherDao trong bộ nhớ. Mọi thao tác khóa trên kho dùng chung, nên kiểm tra giới
 * hạn và tăng usedCount không thể xen kẽ giữa các luồng; đối tượng trả ra luôn là bản sao.
 */
public class InMemoryVoucherDao implements IVoucherDao {
    private final InMemoryDatabase db;

    public InMemoryVoucherDao() {
        this(InMemoryDatabase.getInstance());
    }

    public InMemoryVoucherDao(InMemoryDatabase db) {
        this.db = db;
    }

    @Override
    public List<Voucher> findAll() {
        synchronized (db) {
            return db.getVouchers().values().stream().sorted(Comparator.comparing(Voucher::getId))
                    .map(Voucher::copy).toList();
        }
    }

    @Override
    public Optional<Voucher> findById(int id) {
        synchronized (db) {
            return Optional.ofNullable(db.getVouchers().get(id)).map(Voucher::copy);
        }
    }

    @Override
    public Optional<Voucher> findByCode(String code) {
        if (code == null) return Optional.empty();
        String wanted = code.trim().toUpperCase(Locale.ROOT);
        synchronized (db) {
            return db.getVouchers().values().stream().filter(v -> wanted.equalsIgnoreCase(v.getCode()))
                    .findFirst().map(Voucher::copy);
        }
    }

    @Override
    public boolean save(Voucher voucher) {
        if (voucher == null || voucher.getCode() == null) return false;
        synchronized (db) {
            boolean duplicate = db.getVouchers().values().stream().anyMatch(other ->
                    other.getCode().equalsIgnoreCase(voucher.getCode()) && !other.getId().equals(voucher.getId()));
            if (duplicate) return false;
            Voucher stored = voucher.copy();
            if (stored.getId() == null) {
                stored.setId(db.generateVoucherId());
                stored.setUsedCount(0);
                voucher.setId(stored.getId());
            } else {
                Voucher current = db.getVouchers().get(stored.getId());
                if (current == null) return false;
                // Kiểm tra cùng lúc với lần ghi, dưới cùng khóa với redeem.
                if (stored.getMaxUses() != null && stored.getMaxUses() < current.getUsedCount()) return false;
                stored.setUsedCount(current.getUsedCount());
                stored.setCreatedAt(current.getCreatedAt());
            }
            db.getVouchers().put(stored.getId(), stored);
            return true;
        }
    }

    @Override
    public boolean deleteById(int id) {
        synchronized (db) {
            Voucher voucher = db.getVouchers().get(id);
            // Mã đã có lượt dùng không bị xóa (chỉ tắt), để lượt vừa giữ và lịch sử không mất theo.
            if (voucher == null || voucher.getUsedCount() > 0
                    || db.getVoucherUsages().values().stream().anyMatch(usage -> usage.voucherId() == id)) {
                return false;
            }
            db.getVouchers().remove(id);
            return true;
        }
    }

    @Override
    public RedeemResult redeem(int voucherId, Integer userId, String orderCode, double discountAmount) {
        synchronized (db) {
            Voucher voucher = db.getVouchers().get(voucherId);
            if (voucher == null) return new RedeemResult(RedeemStatus.UNKNOWN_VOUCHER, 0);
            if (voucher.isSoldOut()) return new RedeemResult(RedeemStatus.SOLD_OUT, 0);
            if (userId != null && voucher.getPerAccountLimit() != null
                    && countUsages(voucherId, userId) >= voucher.getPerAccountLimit()) {
                return new RedeemResult(RedeemStatus.ACCOUNT_LIMIT, 0);
            }
            int usageId = db.generateVoucherUsageId();
            db.getVoucherUsages().put(usageId,
                    new VoucherUsage(usageId, voucherId, userId, orderCode, discountAmount, Instant.now()));
            voucher.setUsedCount(voucher.getUsedCount() + 1);
            return new RedeemResult(RedeemStatus.REDEEMED, usageId);
        }
    }

    @Override
    public boolean attachOrder(int usageId, String orderCode) {
        synchronized (db) {
            VoucherUsage usage = db.getVoucherUsages().get(usageId);
            if (usage == null) return false;
            db.getVoucherUsages().put(usageId, usage.withOrderCode(orderCode));
            return true;
        }
    }

    @Override
    public boolean releaseUsage(int usageId) {
        synchronized (db) {
            VoucherUsage usage = db.getVoucherUsages().remove(usageId);
            if (usage == null) return false;
            Voucher voucher = db.getVouchers().get(usage.voucherId());
            if (voucher != null) voucher.setUsedCount(Math.max(0, voucher.getUsedCount() - 1));
            return true;
        }
    }

    @Override
    public boolean releaseByOrder(String orderCode) {
        if (orderCode == null) return false;
        synchronized (db) {
            return findUsageByOrder(orderCode).map(usage -> releaseUsage(usage.id())).orElse(false);
        }
    }

    @Override
    public Optional<VoucherUsage> findUsageByOrder(String orderCode) {
        if (orderCode == null) return Optional.empty();
        synchronized (db) {
            return db.getVoucherUsages().values().stream()
                    .filter(usage -> orderCode.equalsIgnoreCase(usage.orderCode())).findFirst();
        }
    }

    @Override
    public List<VoucherUsage> findUsages(int voucherId) {
        synchronized (db) {
            return db.getVoucherUsages().values().stream().filter(usage -> usage.voucherId() == voucherId)
                    .sorted(Comparator.comparing(VoucherUsage::id)).toList();
        }
    }

    @Override
    public int countUsages(int voucherId, int userId) {
        synchronized (db) {
            return (int) db.getVoucherUsages().values().stream()
                    .filter(usage -> usage.voucherId() == voucherId && Integer.valueOf(userId).equals(usage.userId())).count();
        }
    }
}
