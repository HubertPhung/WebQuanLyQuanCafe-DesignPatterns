package com.dalatcafe.dao;

import com.dalatcafe.model.Customer;
import com.dalatcafe.model.CustomerRank;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderItem;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.OrderType;
import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.model.Reservation;
import com.dalatcafe.model.ReservationStatus;
import com.dalatcafe.model.TableStatus;
import com.dalatcafe.model.UserAccount;
import com.dalatcafe.model.UserRole;
import com.dalatcafe.model.Variation;
import com.dalatcafe.patterns.facade.CheckoutLine;
import com.dalatcafe.patterns.facade.CheckoutRequest;
import com.dalatcafe.patterns.facade.CheckoutResult;
import com.dalatcafe.patterns.facade.Customization;
import com.dalatcafe.patterns.facade.PosCheckoutFacade;
import com.dalatcafe.patterns.observer.OrderEventSubject;
import com.dalatcafe.patterns.observer.TableStatusSyncObserver;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Runs the JDBC DAOs against a real PostgreSQL started in the test JVM (no Docker, no shared
 * Supabase), so schema, JSONB columns, foreign keys and the pool are checked in CI.
 */
class JdbcIntegrationTest {
    private static EmbeddedPostgres postgres;
    private static final JdbcTableDao tables = new JdbcTableDao();
    private static final JdbcMenuDao menu = new JdbcMenuDao();
    private static final JdbcOrderDao orders = new JdbcOrderDao();
    private static final JdbcReservationDao reservations = new JdbcReservationDao();

    @BeforeAll
    static void startPostgres() throws Exception {
        postgres = EmbeddedPostgres.start();
        JdbcDatabase.setCustomConnection(postgres.getJdbcUrl("postgres", "postgres"), "postgres", "postgres");
        InMemoryDatabase.getInstance().reset();
        assertTrue(DaoFactory.prepareJdbcStore(tables, menu));
    }

    @AfterAll
    static void stopPostgres() throws Exception {
        JdbcDatabase.setCustomConnection(null, null, null);
        if (postgres != null) {
            postgres.close();
        }
    }

    @Test
    void schemaUpgradeIsIdempotentAndAddsForeignKeys() throws Exception {
        try (Connection conn = JdbcDatabase.getConnection()) {
            JdbcDatabase.initializeSchema(conn);
            JdbcDatabase.initializeSchema(conn);
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT conname FROM pg_constraint WHERE conname LIKE 'fk_%' ORDER BY conname")) {
                assertTrue(rs.next());
                assertEquals("fk_orders_table", rs.getString(1));
                assertTrue(rs.next());
                assertEquals("fk_reservations_table", rs.getString(1));
            }
        }
        assertTrue(JdbcDatabase.isAvailable());
    }

    @Test
    void seedsFloorPlanAndMenuOnceAndKeepsSequencesAhead() {
        int seededTables = InMemoryDatabase.getInstance().getTables().size();
        assertEquals(seededTables, tables.findAll().size());
        assertTrue(DaoFactory.prepareJdbcStore(tables, menu));
        assertEquals(seededTables, tables.findAll().size());

        int maxId = menu.findAll().stream().mapToInt(MenuItem::getId).max().orElseThrow();
        MenuItem fresh = new MenuItem(null, "Tra atiso", "Tea", 39_000, 12_000);
        assertTrue(menu.save(fresh));
        assertTrue(fresh.getId() > maxId);
    }

    @Test
    void menuVariationsRoundTripThroughJsonb() {
        MenuItem item = new MenuItem(null, "Bac xiu", "Coffee", 35_000, 10_000);
        item.addVariation(new Variation("Size L", 10_000));
        item.addVariation(new Variation("It duong", 0));
        assertTrue(menu.save(item));

        List<Variation> loaded = menu.findById(item.getId()).orElseThrow().getVariations();
        assertEquals(2, loaded.size());
        assertEquals("Size L", loaded.get(0).getName());
        assertEquals(10_000, loaded.get(0).getPrice());
    }

    @Test
    void tableImageRoundTripsAndCanBeRemoved() {
        com.dalatcafe.model.Table table = new com.dalatcafe.model.Table(97531, "Image table", 4, "Garden");
        table.setImageUrl("https://example.com/table.webp");
        assertTrue(tables.save(table));
        assertEquals(table.getImageUrl(), tables.findById(table.getId()).orElseThrow().getImageUrl());
        assertEquals(table.getImageUrl(), tables.findByZone("Garden").stream().filter(t -> t.getId() == table.getId()).findFirst().orElseThrow().getImageUrl());
        table.setImageUrl(null);
        assertTrue(tables.save(table));
        assertNull(tables.findById(table.getId()).orElseThrow().getImageUrl());
        assertTrue(tables.deleteById(table.getId()));
    }

    @Test
    void tableArchivingPreservesRowsAndNeverReusesIds() throws Exception {
        int id = 99531;
        assertTrue(tables.save(new com.dalatcafe.model.Table(id, "Archived table", 4, "Archive test")));
        Order order = new Order(null, "DB-ARCHIVED-HISTORY", "Buyer", id, OrderType.DINE_IN);
        order.setStatus(OrderStatus.COMPLETED); order.setPaymentStatus(PaymentStatus.PAID);
        assertTrue(orders.save(order));
        assertTrue(tables.archiveById(id));
        assertTrue(new JdbcTableDao().findById(id).isEmpty());
        assertTrue(tables.findByZone("Archive test").isEmpty());
        assertTrue(tables.findAll().stream().noneMatch(table -> table.getId() == id));
        assertFalse(tables.updateStatus(id, TableStatus.AVAILABLE, 0));
        assertTrue(tables.nextId() > id);
        assertEquals(id, orders.findByOrderCode("DB-ARCHIVED-HISTORY").orElseThrow().getTableId());
        try (Connection connection = JdbcDatabase.getConnection(); Statement statement = connection.createStatement();
             ResultSet row = statement.executeQuery("SELECT deleted_at FROM tables WHERE id = " + id)) {
            assertTrue(row.next()); assertNotNull(row.getTimestamp(1));
        }
    }

    @Test
    void groupedTablesAndAtomicPaymentRoundTripThroughPostgres() {
        Reservation reservation = new Reservation();
        reservation.setReservationCode("DB-GROUP-BOOKING"); reservation.setCustomer("Group"); reservation.setContact("0901234567");
        reservation.setDateTime(Instant.now().plusSeconds(86400)); reservation.setTableIds(List.of(1, 3)); reservation.setGuests(5);
        assertTrue(reservations.save(reservation));
        assertEquals(List.of(1, 3), reservations.findById(reservation.getId()).orElseThrow().getTableIds());
        Order first = new Order(null, "DB-GROUP-PAY-A", "Group", 1, OrderType.DINE_IN);
        first.setTableIds(List.of(1, 3)); first.addItem(new OrderItem(null, "Drink", 1, 50000, null, null));
        Order second = new Order(null, "DB-GROUP-PAY-B", "Group", 2, OrderType.DINE_IN);
        second.addItem(new OrderItem(null, "Drink", 1, 40000, null, null));
        assertTrue(orders.save(first)); assertTrue(orders.save(second));
        assertEquals(List.of(1, 3), orders.findById(first.getId()).orElseThrow().getTableIds());
        assertTrue(orders.findByTableId(3).stream().anyMatch(order -> order.getOrderCode().equals(first.getOrderCode())));
        java.util.concurrent.atomic.AtomicInteger charges = new java.util.concurrent.atomic.AtomicInteger();
        assertFalse(orders.markPaidTogether(List.of(first.getId(), second.getId()), PaymentMethod.CARD, () -> false));
        assertEquals(PaymentStatus.UNPAID, orders.findById(first.getId()).orElseThrow().getPaymentStatus());
        assertTrue(orders.markPaidTogether(List.of(first.getId(), second.getId()), PaymentMethod.CARD, () -> { charges.incrementAndGet(); return true; }));
        assertFalse(orders.markPaidTogether(List.of(first.getId(), second.getId()), PaymentMethod.CARD, () -> { charges.incrementAndGet(); return true; }));
        assertEquals(1, charges.get());
        assertEquals(PaymentStatus.PAID, orders.findById(first.getId()).orElseThrow().getPaymentStatus());
        assertEquals(PaymentStatus.PAID, orders.findById(second.getId()).orElseThrow().getPaymentStatus());
    }

    @Test
    void orderKeepsLineItemsAndPaidTotals() {
        Order order = new Order(null, null, "Khach le", 3, OrderType.DINE_IN);
        order.addItem(new OrderItem(1, "Latte", 2, 55_000, "Size L", "it da"));
        order.addItem(new OrderItem(2, "Croissant", 1, 30_000, null, null));
        order.setDiscountAmount(14_000);
        order.setPaymentMethod(PaymentMethod.QR);
        order.setPaymentStatus(PaymentStatus.PAID);
        assertTrue(orders.save(order));
        assertTrue(order.getOrderCode().matches("AC-\\d{4,}"), order.getOrderCode());

        Order loaded = orders.findByOrderCode(order.getOrderCode()).orElseThrow();
        assertEquals(2, loaded.getItems().size());
        assertEquals("Size L", loaded.getItems().get(0).getVariation());
        assertEquals(1, loaded.getItems().get(0).getMenuItemId());
        assertEquals(140_000, loaded.getSubtotal());
        assertEquals(14_000, loaded.getDiscountAmount());
        assertEquals(order.getTotal(), loaded.getTotal());
        assertEquals(PaymentStatus.PAID, loaded.getPaymentStatus());

        loaded.setStatus(OrderStatus.COMPLETED);
        assertTrue(orders.save(loaded));
        Order completed = orders.findById(loaded.getId()).orElseThrow();
        assertEquals(OrderStatus.COMPLETED, completed.getStatus());
        assertNotNull(completed.getCompletedAt());
        assertEquals(2, completed.getItems().size());
    }

    @Test
    void foreignKeyRejectsOrdersForUnknownTables() {
        Order ghost = new Order(null, null, "Ghost", 9_999, OrderType.DINE_IN);
        ghost.addItem(new OrderItem("Latte", 1, 55_000));
        assertFalse(orders.save(ghost));
    }

    @Test
    void reservationKeepsPreOrdersAndGetsReadableCode() {
        Reservation reservation = new Reservation(null, null, "Tran Tri", "0933112233",
                Instant.now().plusSeconds(86_400), 4);
        reservation.setTableId(5);
        reservation.setTableName("Bàn 05");
        reservation.setStatus(ReservationStatus.PENDING);
        reservation.addPreOrder(new OrderItem("Latte", 2, 55_000));
        assertTrue(reservations.save(reservation));
        assertTrue(reservation.getReservationCode().matches("RES-\\d{4,}"), reservation.getReservationCode());

        Reservation loaded = reservations.findByReservationCode(reservation.getReservationCode()).orElseThrow();
        assertEquals(1, loaded.getPreOrders().size());
        assertEquals(2, loaded.getPreOrders().get(0).getQty());
        assertTrue(reservations.updateStatus(loaded.getId(), ReservationStatus.CONFIRMED));
        assertEquals(ReservationStatus.CONFIRMED, reservations.findById(loaded.getId()).orElseThrow().getStatus());
    }

    @Test
    void checkoutFacadePersistsEverythingOnPostgres() {
        MenuItem drink = new MenuItem(null, "Ca phe muoi", "Coffee", 45_000, 15_000);
        assertTrue(menu.save(drink));
        tables.updateStatus(6, TableStatus.AVAILABLE, 0);
        OrderEventSubject subject = new OrderEventSubject();
        subject.attach(new TableStatusSyncObserver(tables));
        PosCheckoutFacade facade = new PosCheckoutFacade(orders, menu, subject);

        CheckoutResult result = facade.checkout(new CheckoutRequest(
                List.of(new CheckoutLine(drink.getId(), 2, Set.of(Customization.SIZE_L))), 6,
                OrderType.DINE_IN, PaymentMethod.CASH, null, null, null));

        assertTrue(result.isSuccess(), result.getMessage());
        Order saved = orders.findByOrderCode(result.getOrder().getOrderCode()).orElseThrow();
        assertEquals(1, saved.getItems().size());
        assertEquals(2, saved.getItems().get(0).getQty());
        assertEquals(OrderStatus.PENDING, saved.getStatus());
        assertEquals(PaymentStatus.PAID, saved.getPaymentStatus());
        assertEquals(TableStatus.OCCUPIED, tables.findById(6).orElseThrow().getStatus());
    }

    @Test
    void reseatingAnOccupiedTableKeepsWhenTheGuestsSatDown() throws Exception {
        assertTrue(tables.updateStatus(9, TableStatus.AVAILABLE, 0));
        assertTrue(tables.updateStatus(9, TableStatus.OCCUPIED, 2));
        try (Connection conn = JdbcDatabase.getConnection();
             Statement st = conn.createStatement()) {
            st.executeUpdate("UPDATE tables SET occupied_since = now() - interval '40 minutes' WHERE id = 9");
        }
        Instant seatedAt = tables.findById(9).orElseThrow().getOccupiedSince();

        // A second paid order (or a guest-count change) on the same party must not restart the clock.
        assertTrue(tables.updateStatus(9, TableStatus.OCCUPIED, 3));
        assertEquals(seatedAt, tables.findById(9).orElseThrow().getOccupiedSince());
        assertEquals(3, tables.findById(9).orElseThrow().getGuestCount());

        assertTrue(tables.updateStatus(9, TableStatus.CLEANING, 0));
        assertNull(tables.findById(9).orElseThrow().getOccupiedSince());
        assertTrue(tables.updateStatus(9, TableStatus.OCCUPIED, 1));
        Instant nextParty = tables.findById(9).orElseThrow().getOccupiedSince();
        assertNotNull(nextParty);
        assertTrue(nextParty.isAfter(seatedAt), "a new party starts a new clock");
    }

    @Test
    void userAccountsRoundTripAndStayUnique() {
        JdbcUserDao users = new JdbcUserDao();
        UserAccount staff = new UserAccount(null, "Barista@DalatCafe.vn", "Barista", UserRole.STAFF);
        staff.setPasswordHash("pbkdf2_sha256$10000$c2FsdA==$aGFzaA==");
        assertTrue(users.save(staff));
        assertNotNull(staff.getId());

        UserAccount loaded = users.findByEmail("barista@dalatcafe.vn").orElseThrow();
        assertEquals(UserRole.STAFF, loaded.getRole());
        assertEquals(staff.getPasswordHash(), loaded.getPasswordHash());
        assertTrue(loaded.isActive());

        assertFalse(users.save(new UserAccount(null, "BARISTA@dalatcafe.vn", "Copy", UserRole.CUSTOMER)), "emails are unique");
        loaded.setGoogleSubject("google-42");
        loaded.setRole(UserRole.MANAGER);
        loaded.setActive(false);
        assertTrue(users.save(loaded));
        UserAccount updated = users.findByGoogleSubject("google-42").orElseThrow();
        assertEquals(UserRole.MANAGER, updated.getRole());
        assertFalse(updated.isActive());
        UserAccount sameGoogle = new UserAccount(null, "other@dalatcafe.vn", "Other", UserRole.CUSTOMER);
        sameGoogle.setGoogleSubject("google-42");
        assertFalse(users.save(sameGoogle), "Google ids are unique");
        assertTrue(users.findAll().size() >= 1);
    }

    @Test
    void concurrentEarnAndRedeemOnOneMemberKeepEveryChange() throws Exception {
        JdbcCustomerDao customers = new JdbcCustomerDao();
        int workers = JdbcDatabase.POOL_SIZE / 2;
        int rounds = 50;
        Customer member = new Customer(null, "Khach dong thoi", "0988000111", null);
        assertTrue(customers.save(member));
        int id = member.getId();
        int opening = workers * rounds;
        assertTrue(customers.addOrderRecord(id, 0, opening));

        List<Runnable> tasks = new ArrayList<>();
        for (int w = 0; w < workers; w++) {
            tasks.add(() -> {
                for (int i = 0; i < rounds; i++) {
                    assertTrue(customers.addOrderRecord(id, 1_000, 1));
                }
            });
            tasks.add(() -> {
                for (int i = 0; i < rounds; i++) {
                    assertTrue(customers.redeemPoints(id, 1));
                }
            });
        }
        Concurrently.run(tasks);

        Customer after = customers.findById(id).orElseThrow();
        assertEquals(opening, after.getLoyaltyPoints(), "every earned and redeemed point is counted");
        assertEquals(1 + workers * rounds, after.getTotalOrders());
        assertEquals(workers * rounds * 1_000.0, after.getTotalSpent());
    }

    @Test
    void redeemingMoreThanTheBalanceChangesNothing() {
        JdbcCustomerDao customers = new JdbcCustomerDao();
        Customer member = new Customer(null, "Khach it diem", "0988000222", null);
        assertTrue(customers.save(member));
        assertTrue(customers.addOrderRecord(member.getId(), 600_000, 10));

        assertFalse(customers.redeemPoints(member.getId(), 11));
        assertFalse(customers.redeemPoints(member.getId(), 0));
        assertFalse(customers.redeemPoints(999_999, 1), "unknown member");
        assertFalse(customers.addOrderRecord(999_999, 1_000, 1), "unknown member");

        Customer after = customers.findById(member.getId()).orElseThrow();
        assertEquals(10, after.getLoyaltyPoints());
        assertEquals(1, after.getTotalOrders());
        assertEquals(CustomerRank.SILVER, after.getRank(), "rank follows lifetime spend");
        assertTrue(customers.redeemPoints(member.getId(), 10));
        assertEquals(0, customers.findById(member.getId()).orElseThrow().getLoyaltyPoints());
    }

    @Test
    void restoringPointsGivesThemBackWithoutCountingAVisit() {
        JdbcCustomerDao customers = new JdbcCustomerDao();
        Customer member = new Customer(null, "Khach hoan diem", "0988000444", null);
        assertTrue(customers.save(member));
        assertTrue(customers.addOrderRecord(member.getId(), 600_000, 30));
        assertTrue(customers.redeemPoints(member.getId(), 30));

        assertTrue(customers.restorePoints(member.getId(), 12));
        assertFalse(customers.restorePoints(member.getId(), 0));
        assertFalse(customers.restorePoints(999_999, 1), "unknown member");

        Customer after = customers.findById(member.getId()).orElseThrow();
        assertEquals(12, after.getLoyaltyPoints());
        assertEquals(1, after.getTotalOrders());
        assertEquals(600_000.0, after.getTotalSpent());
        assertEquals(CustomerRank.SILVER, after.getRank());
    }

    @Test
    void pooledConnectionsAreReusedAndUnusableAfterClose() throws Exception {
        Connection first = JdbcDatabase.getConnection();
        first.close();
        assertTrue(first.isClosed());
        assertThrows(SQLException.class, first::createStatement);
        for (int i = 0; i < JdbcDatabase.POOL_SIZE * 3; i++) {
            try (Connection conn = JdbcDatabase.getConnection();
                 Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT 1")) {
                assertTrue(rs.next());
            }
        }
        try (Connection conn = JdbcDatabase.getConnection()) {
            conn.setAutoCommit(false);
        }
        try (Connection conn = JdbcDatabase.getConnection()) {
            assertTrue(conn.getAutoCommit(), "a returned connection is reset to auto-commit");
        }
    }
}
