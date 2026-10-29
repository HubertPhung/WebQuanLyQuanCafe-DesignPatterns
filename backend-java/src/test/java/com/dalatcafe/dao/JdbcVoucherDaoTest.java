package com.dalatcafe.dao;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.*;

/** Cùng hợp đồng với kho trong bộ nhớ, chạy trên PostgreSQL nhúng. */
class JdbcVoucherDaoTest extends VoucherDaoContract {
    private static EmbeddedPostgres postgres;

    @BeforeAll
    static void startPostgres() throws Exception {
        postgres = EmbeddedPostgres.start();
        JdbcDatabase.setCustomConnection(postgres.getJdbcUrl("postgres", "postgres"), "postgres", "postgres");
        InMemoryDatabase.getInstance().reset();
        assertTrue(DaoFactory.prepareJdbcStore(new JdbcTableDao(), new JdbcMenuDao()));
    }

    @AfterAll
    static void stopPostgres() throws Exception {
        JdbcDatabase.setCustomConnection(null, null, null);
        if (postgres != null) {
            postgres.close();
        }
    }

    @BeforeEach
    void emptyVouchers() throws Exception {
        try (Connection conn = JdbcDatabase.getConnection(); Statement st = conn.createStatement()) {
            st.execute("TRUNCATE vouchers, voucher_usages RESTART IDENTITY CASCADE");
        }
    }

    @Override
    protected IVoucherDao newDao() {
        return new JdbcVoucherDao();
    }

    @Test
    void welcomeVoucherIsSeededOnFirstPrepare() {
        assertTrue(DaoFactory.prepareJdbcStore(new JdbcTableDao(), new JdbcMenuDao()));
        var welcome = newDao().findByCode("WELCOME10").orElseThrow();
        assertEquals(1, welcome.getPerAccountLimit());
        assertTrue(welcome.isFirstOnlineOrderOnly());
        assertNull(welcome.getMaxUses());
        // Lần chuẩn bị sau không seed thêm bản thứ hai.
        assertTrue(DaoFactory.prepareJdbcStore(new JdbcTableDao(), new JdbcMenuDao()));
        assertEquals(1, newDao().findAll().size());
    }

    @Test
    void ordersHaveVoucherCodeColumn() throws Exception {
        try (Connection conn = JdbcDatabase.getConnection(); Statement st = conn.createStatement();
             var rs = st.executeQuery("SELECT column_name FROM information_schema.columns "
                     + "WHERE table_name = 'orders' AND column_name = 'voucher_code'")) {
            assertTrue(rs.next());
        }
    }
}
