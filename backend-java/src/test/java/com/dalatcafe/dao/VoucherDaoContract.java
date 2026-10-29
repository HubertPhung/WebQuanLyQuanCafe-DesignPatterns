package com.dalatcafe.dao;

import com.dalatcafe.model.Voucher;
import com.dalatcafe.model.VoucherType;
import com.dalatcafe.model.VoucherUsage;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/** Hợp đồng chung mà mọi bản cài đặt IVoucherDao phải giữ, kể cả khi nhiều luồng giữ lượt cùng lúc. */
abstract class VoucherDaoContract {
    protected abstract IVoucherDao newDao();

    static Voucher voucher(String code, Integer maxUses, Integer perAccountLimit) {
        Voucher v = new Voucher();
        v.setCode(code);
        v.setType(VoucherType.FIXED);
        v.setValue(10_000);
        v.setMaxUses(maxUses);
        v.setPerAccountLimit(perAccountLimit);
        v.setStartDate(LocalDate.of(2026, 1, 1));
        v.setEndDate(LocalDate.of(2026, 12, 31));
        v.setActive(true);
        return v;
    }

    private int saved(IVoucherDao dao, Voucher v) {
        assertTrue(dao.save(v));
        return v.getId();
    }

    @Test
    void saveAssignsIdAndRejectsDuplicateCode() {
        IVoucherDao dao = newDao();
        Voucher first = voucher("SALE1111", null, null);
        assertTrue(dao.save(first));
        assertNotNull(first.getId());
        assertFalse(dao.save(voucher("sale1111", null, null)));
    }

    @Test
    void findByCodeIgnoresCase() {
        IVoucherDao dao = newDao();
        int id = saved(dao, voucher("SALE1111", null, null));
        assertEquals(id, dao.findByCode("sale1111").orElseThrow().getId());
        assertTrue(dao.findByCode("KHONGCO").isEmpty());
    }

    @Test
    void updateKeepsUsedCount() {
        IVoucherDao dao = newDao();
        Voucher v = voucher("SALE1111", 5, null);
        int id = saved(dao, v);
        dao.redeem(id, null, null, 10_000);
        Voucher edited = dao.findById(id).orElseThrow();
        edited.setUsedCount(0);
        edited.setMinOrder(50_000);
        assertTrue(dao.save(edited));
        Voucher reread = dao.findById(id).orElseThrow();
        assertEquals(1, reread.getUsedCount());
        assertEquals(50_000, reread.getMinOrder());
    }

    @Test
    void redeemStopsAtMaxUses() {
        IVoucherDao dao = newDao();
        int id = saved(dao, voucher("SALE1111", 2, null));
        assertEquals(IVoucherDao.RedeemStatus.REDEEMED, dao.redeem(id, null, null, 10_000).status());
        assertEquals(IVoucherDao.RedeemStatus.REDEEMED, dao.redeem(id, null, null, 10_000).status());
        assertEquals(IVoucherDao.RedeemStatus.SOLD_OUT, dao.redeem(id, null, null, 10_000).status());
        assertEquals(2, dao.findById(id).orElseThrow().getUsedCount());
    }

    @Test
    void redeemUnknownVoucher() {
        assertEquals(IVoucherDao.RedeemStatus.UNKNOWN_VOUCHER, newDao().redeem(987654, null, null, 0).status());
    }

    @Test
    void redeemStopsAtPerAccountLimit() {
        IVoucherDao dao = newDao();
        int id = saved(dao, voucher("SALE1111", null, 1));
        assertEquals(IVoucherDao.RedeemStatus.REDEEMED, dao.redeem(id, 7, null, 10_000).status());
        assertEquals(IVoucherDao.RedeemStatus.ACCOUNT_LIMIT, dao.redeem(id, 7, null, 10_000).status());
        assertEquals(IVoucherDao.RedeemStatus.REDEEMED, dao.redeem(id, 8, null, 10_000).status());
        assertEquals(IVoucherDao.RedeemStatus.REDEEMED, dao.redeem(id, null, null, 10_000).status());
        assertEquals(IVoucherDao.RedeemStatus.REDEEMED, dao.redeem(id, null, null, 10_000).status());
        assertEquals(4, dao.findById(id).orElseThrow().getUsedCount());
    }

    @Test
    void concurrentRedeemNeverExceedsMax() throws Exception {
        IVoucherDao dao = newDao();
        int id = saved(dao, voucher("SALE1111", 5, null));
        AtomicInteger redeemed = new AtomicInteger();
        List<Runnable> tasks = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            tasks.add(() -> {
                if (dao.redeem(id, null, null, 10_000).status() == IVoucherDao.RedeemStatus.REDEEMED) {
                    redeemed.incrementAndGet();
                }
            });
        }
        Concurrently.run(tasks);
        assertEquals(5, redeemed.get());
        assertEquals(5, dao.findById(id).orElseThrow().getUsedCount());
    }

    @Test
    void releaseIsIdempotent() {
        IVoucherDao dao = newDao();
        int id = saved(dao, voucher("SALE1111", null, null));
        IVoucherDao.RedeemResult result = dao.redeem(id, null, null, 10_000);
        assertTrue(dao.attachOrder(result.usageId(), "ORD-1"));
        assertTrue(dao.releaseByOrder("ORD-1"));
        assertEquals(0, dao.findById(id).orElseThrow().getUsedCount());
        assertFalse(dao.releaseByOrder("ORD-1"));
        assertEquals(0, dao.findById(id).orElseThrow().getUsedCount());
        assertFalse(dao.releaseByOrder("KHONG-CO"));
    }

    @Test
    void releaseUsageBeforeAttach() {
        IVoucherDao dao = newDao();
        int id = saved(dao, voucher("SALE1111", null, null));
        IVoucherDao.RedeemResult result = dao.redeem(id, null, null, 10_000);
        assertTrue(dao.releaseUsage(result.usageId()));
        assertFalse(dao.releaseUsage(result.usageId()));
        assertEquals(0, dao.findById(id).orElseThrow().getUsedCount());
    }

    @Test
    void findUsagesAndCount() {
        IVoucherDao dao = newDao();
        int id = saved(dao, voucher("SALE1111", null, null));
        dao.redeem(id, 7, "ORD-A", 10_000);
        dao.redeem(id, 7, "ORD-B", 8_000);
        assertEquals(2, dao.countUsages(id, 7));
        assertEquals(0, dao.countUsages(id, 8));
        assertEquals(2, dao.findUsages(id).size());
        VoucherUsage usage = dao.findUsageByOrder("ORD-B").orElseThrow();
        assertEquals(8_000, usage.discountAmount());
        assertEquals(id, usage.voucherId());
    }

    @Test
    void deleteRemovesVoucher() {
        IVoucherDao dao = newDao();
        int id = saved(dao, voucher("SALE1111", null, null));
        assertTrue(dao.deleteById(id));
        assertTrue(dao.findById(id).isEmpty());
    }

    @Test
    void duplicateOrderCodeFailsWithoutCounting() {
        // Một đơn chỉ giữ một lượt; lần giữ thứ hai là lỗi lưu trữ, không phải "mã không tồn tại".
        IVoucherDao dao = newDao();
        int id = saved(dao, voucher("SALE1111", null, null));
        assertEquals(IVoucherDao.RedeemStatus.REDEEMED, dao.redeem(id, null, "ORD-1", 10_000).status());
        assertEquals(IVoucherDao.RedeemStatus.FAILED, dao.redeem(id, null, "ORD-1", 10_000).status());
        assertEquals(1, dao.findById(id).orElseThrow().getUsedCount());
    }

    @Test
    void saveRefusesMaxUsesBelowUsedCount() {
        // Kiểm tra nằm trong chính lần ghi, nên một lượt redeem chen vào giữa không làm vượt giới hạn.
        IVoucherDao dao = newDao();
        int id = saved(dao, voucher("SALE1111", 5, null));
        dao.redeem(id, null, "ORD-1", 10_000);
        dao.redeem(id, null, "ORD-2", 10_000);
        Voucher lowered = dao.findById(id).orElseThrow();
        lowered.setMaxUses(1);
        assertFalse(dao.save(lowered));
        assertEquals(5, dao.findById(id).orElseThrow().getMaxUses());
        lowered.setMaxUses(2);
        assertTrue(dao.save(lowered));
    }

    @Test
    void deleteRefusesUsedVoucherAndKeepsUsages() {
        // Một lượt redeem vừa giữ không được bị xóa theo voucher (lịch sử và mức giảm của đơn COD).
        IVoucherDao dao = newDao();
        int id = saved(dao, voucher("SALE1111", null, null));
        dao.redeem(id, null, "ORD-1", 10_000);
        assertFalse(dao.deleteById(id));
        assertTrue(dao.findById(id).isPresent());
        assertTrue(dao.findUsageByOrder("ORD-1").isPresent());
    }
}
