package com.dalatcafe.patterns.observer;

import com.dalatcafe.model.Order;
import com.dalatcafe.server.VoucherService;

import java.util.Objects;

/**
 * Observer trả lại lượt voucher khi đơn bị hủy, ở bất kỳ đâu (quầy, KDS, đơn online). Đơn không
 * dùng voucher hay đã được trả lượt rồi thì không có gì xảy ra, nên hủy hai lần không trả hai lần.
 */
public class VoucherReleaseObserver implements IOrderObserver {
    private final VoucherService vouchers;

    public VoucherReleaseObserver(VoucherService vouchers) {
        this.vouchers = Objects.requireNonNull(vouchers, "Voucher service must not be null");
    }

    @Override
    public void onOrderCancelled(Order order) {
        if (order != null && order.getOrderCode() != null) {
            vouchers.releaseOrder(order.getOrderCode());
        }
    }
}
