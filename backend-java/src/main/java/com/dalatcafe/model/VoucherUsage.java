package com.dalatcafe.model;

import java.time.Instant;

/**
 * Một lượt dùng voucher. Lượt được giữ trước khi đơn có mã (orderCode null), rồi gắn vào đơn khi
 * đơn được tạo; số tiền giảm ghi lại để đơn đồng bộ sau đó dùng đúng con số khách đã thấy.
 */
public record VoucherUsage(int id, int voucherId, Integer userId, String orderCode, double discountAmount,
                           Instant createdAt) {
    public VoucherUsage withOrderCode(String code) {
        return new VoucherUsage(id, voucherId, userId, code, discountAmount, createdAt);
    }
}
