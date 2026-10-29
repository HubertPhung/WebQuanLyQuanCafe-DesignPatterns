package com.dalatcafe.dao;

import com.dalatcafe.model.Voucher;
import com.dalatcafe.model.VoucherUsage;

import java.util.List;
import java.util.Optional;

/**
 * Interface Data Access Object cho voucher và các lượt dùng của nó. Việc giữ lượt (redeem) là
 * một thao tác nguyên tử: không bao giờ vượt maxUses hay perAccountLimit, kể cả khi nhiều request
 * chạy cùng lúc.
 */
public interface IVoucherDao {
    /** FAILED: không ghi được (lỗi database, hoặc đơn này đã giữ một lượt rồi); không có lượt nào bị trừ. */
    enum RedeemStatus { REDEEMED, SOLD_OUT, ACCOUNT_LIMIT, UNKNOWN_VOUCHER, FAILED }

    record RedeemResult(RedeemStatus status, int usageId) {
    }

    List<Voucher> findAll();
    Optional<Voucher> findById(int id);
    /** So khớp không phân biệt hoa thường. */
    Optional<Voucher> findByCode(String code);
    /** id null thì thêm mới và gán id; ngược lại cập nhật mọi trường trừ usedCount. False khi trùng mã. */
    boolean save(Voucher voucher);
    boolean deleteById(int id);

    /** userId null thì không áp giới hạn theo tài khoản; orderCode có thể gắn sau bằng attachOrder. */
    RedeemResult redeem(int voucherId, Integer userId, String orderCode, double discountAmount);
    boolean attachOrder(int usageId, String orderCode);
    /** Nhả một lượt và giảm usedCount; false khi không còn gì để nhả. */
    boolean releaseUsage(int usageId);
    boolean releaseByOrder(String orderCode);

    Optional<VoucherUsage> findUsageByOrder(String orderCode);
    List<VoucherUsage> findUsages(int voucherId);
    int countUsages(int voucherId, int userId);
}
