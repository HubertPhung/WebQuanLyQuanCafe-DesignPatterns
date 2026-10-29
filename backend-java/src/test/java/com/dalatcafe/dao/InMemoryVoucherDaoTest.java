package com.dalatcafe.dao;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryVoucherDaoTest extends VoucherDaoContract {
    @BeforeEach
    void resetStore() {
        InMemoryDatabase.getInstance().reset();
    }

    @Override
    protected IVoucherDao newDao() {
        return new InMemoryVoucherDao();
    }

    @Test
    void welcomeVoucherIsSeeded() {
        var welcome = newDao().findByCode("WELCOME10").orElseThrow();
        assertEquals(10, welcome.getValue());
        assertEquals(50_000, welcome.getMaxDiscount());
        assertNull(welcome.getMaxUses());
        assertEquals(1, welcome.getPerAccountLimit());
        assertTrue(welcome.isFirstOnlineOrderOnly());
    }

    @Test
    void factoryProvidesVoucherDao() {
        assertNotNull(DaoFactory.getInstance().getVoucherDao());
    }
}
