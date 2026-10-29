package com.dalatcafe.server;

import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.dao.InMemoryVoucherDao;
import com.dalatcafe.model.Voucher;
import com.dalatcafe.model.VoucherType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

class VoucherServiceTest {
    private InMemoryVoucherDao dao;
    private VoucherService service;

    @BeforeEach
    void setUp() {
        InMemoryDatabase.getInstance().reset();
        dao = new InMemoryVoucherDao();
        service = new VoucherService(dao, Clock.fixed(Instant.parse("2026-11-05T03:00:00Z"), ZoneOffset.UTC));
    }

    private Voucher save(String code, VoucherType type, double value) {
        Voucher v = new Voucher();
        v.setCode(code);
        v.setType(type);
        v.setValue(value);
        v.setStartDate(LocalDate.of(2026, 11, 1));
        v.setEndDate(LocalDate.of(2026, 11, 30));
        v.setActive(true);
        assertTrue(dao.save(v));
        return v;
    }

    @Test
    void checkNormalizesCode() {
        save("SALE1111", VoucherType.PERCENT, 10);
        VoucherService.Verdict verdict = service.check(" sale1111 ", 100_000, null, false);
        assertTrue(verdict.valid());
        assertEquals("SALE1111", verdict.code());
        assertEquals(10_000, verdict.discountAmount());
    }

    @Test
    void unknownCodeIsNotFound() {
        assertEquals(VoucherService.Reason.NOT_FOUND, service.check("KHONGCO", 100_000, null, false).reason());
        assertEquals("Mã không tồn tại.", service.check("KHONGCO", 100_000, null, false).message());
    }

    @Test
    void belowMinOrderReportsShortfall() {
        Voucher v = save("SALE1111", VoucherType.FIXED, 10_000);
        v.setMinOrder(150_000);
        dao.save(v);
        VoucherService.Verdict verdict = service.check("SALE1111", 120_000, null, false);
        assertEquals(VoucherService.Reason.BELOW_MIN_ORDER, verdict.reason());
        assertEquals(30_000, verdict.shortfall());
        assertTrue(verdict.message().contains("cần mua thêm"));
        assertEquals(0, verdict.discountAmount());
    }

    @Test
    void percentRespectsCap() {
        Voucher v = save("SALE20", VoucherType.PERCENT, 20);
        v.setMaxDiscount(30_000.0);
        dao.save(v);
        assertEquals(30_000, service.check("SALE20", 200_000, null, false).discountAmount());
    }

    @Test
    void fixedNeverExceedsSubtotal() {
        save("GIAM50K", VoucherType.FIXED, 50_000);
        assertEquals(40_000, service.check("GIAM50K", 40_000, null, false).discountAmount());
    }

    @Test
    void perAccountNeedsLogin() {
        Voucher v = save("SALE1111", VoucherType.FIXED, 10_000);
        v.setPerAccountLimit(1);
        dao.save(v);
        assertEquals(VoucherService.Reason.LOGIN_REQUIRED, service.check("SALE1111", 100_000, null, true).reason());
        assertTrue(service.check("SALE1111", 100_000, 7, true).valid());
    }

    @Test
    void accountLimitReachedAfterUse() {
        Voucher v = save("SALE1111", VoucherType.FIXED, 10_000);
        v.setPerAccountLimit(1);
        dao.save(v);
        service.redeem("SALE1111", 100_000, 7, "ORD-1", true);
        assertEquals(VoucherService.Reason.ACCOUNT_LIMIT, service.check("SALE1111", 100_000, 7, true).reason());
    }

    @Test
    void onlineOnlyRejectsPos() {
        assertEquals(VoucherService.Reason.ONLINE_ONLY, service.check("WELCOME10", 100_000, 7, false).reason());
        assertTrue(service.check("WELCOME10", 100_000, 7, true).valid());
    }

    @Test
    void disabledVoucherIsRejected() {
        Voucher v = save("SALE1111", VoucherType.FIXED, 10_000);
        v.setActive(false);
        dao.save(v);
        assertEquals(VoucherService.Reason.DISABLED, service.check("SALE1111", 100_000, null, false).reason());
    }

    @Test
    void notStartedAndExpired() {
        Voucher later = save("LATER", VoucherType.FIXED, 10_000);
        later.setStartDate(LocalDate.of(2026, 11, 6));
        dao.save(later);
        assertEquals(VoucherService.Reason.NOT_STARTED, service.check("LATER", 100_000, null, false).reason());
        Voucher old = save("OLD", VoucherType.FIXED, 10_000);
        old.setStartDate(LocalDate.of(2026, 10, 1));
        old.setEndDate(LocalDate.of(2026, 11, 4));
        dao.save(old);
        assertEquals(VoucherService.Reason.EXPIRED, service.check("OLD", 100_000, null, false).reason());
    }

    @Test
    void redeemThrowsWithReasonMessage() {
        Voucher v = save("SALE1111", VoucherType.FIXED, 10_000);
        v.setMaxUses(1);
        dao.save(v);
        VoucherService.Redemption first = service.redeem("SALE1111", 100_000, null, null, false);
        assertEquals(10_000, first.discountAmount());
        ApiException e = assertThrows(ApiException.class, () -> service.redeem("SALE1111", 100_000, null, null, false));
        assertEquals(400, e.getStatus());
        assertEquals("INVALID_VOUCHER", e.getCode());
        assertEquals("Mã đã hết lượt sử dụng.", e.getMessage());
    }

    @Test
    void releaseAndAttachRoundTrip() {
        Voucher v = save("SALE1111", VoucherType.FIXED, 10_000);
        VoucherService.Redemption redemption = service.redeem("SALE1111", 100_000, null, null, false);
        service.attachOrder(redemption, "ORD-7");
        assertEquals(10_000, service.usageForOrder("ORD-7").orElseThrow().discountAmount());
        assertTrue(service.releaseOrder("ORD-7"));
        assertFalse(service.releaseOrder("ORD-7"));
        assertEquals(0, dao.findById(v.getId()).orElseThrow().getUsedCount());
        assertEquals("SALE1111", service.findById(v.getId()).orElseThrow().getCode());
    }
}
