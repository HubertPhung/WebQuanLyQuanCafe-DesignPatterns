package com.dalatcafe.dao;

import com.dalatcafe.model.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Đà Lạt Cafe - DAO Persistence Layer & In-Memory Store Unit Tests")
class DaoLayerTest {

    private InMemoryDatabase db;
    private ITableDao tableDao;
    private IMenuDao menuDao;
    private IOrderDao orderDao;
    private IReservationDao reservationDao;
    private ICustomerDao customerDao;

    @BeforeEach
    void setUp() {
        db = InMemoryDatabase.getInstance();
        db.reset(); // Reset to fresh baseline for each test
        tableDao = new InMemoryTableDao(db);
        menuDao = new InMemoryMenuDao(db);
        orderDao = new InMemoryOrderDao(db);
        reservationDao = new InMemoryReservationDao(db);
        customerDao = new InMemoryCustomerDao(db);
    }

    @Nested
    @DisplayName("Table DAO Tests")
    class TableDaoTests {

        @Test
        @DisplayName("findAll should return 15 tables at Phan Đình Phùng and 8 at Bùi Thị Xuân")
        void testFindAllTables() {
            List<Table> tables = tableDao.findAll();
            assertEquals(23, tables.size(), "15 + 8 seeded tables");
            assertEquals("Bàn 01", tables.get(0).getName());
            assertEquals("Bàn 15", tables.get(14).getName());
            assertEquals(15, tables.stream().filter(t -> com.dalatcafe.model.Branches.PHAN_DINH_PHUNG.equals(t.getBranch())).count());
            assertEquals(8, tables.stream().filter(t -> com.dalatcafe.model.Branches.BUI_THI_XUAN.equals(t.getBranch())).count());
        }

        @Test
        @DisplayName("findById should find existing table and return empty for non-existent")
        void testFindById() {
            Optional<Table> t1 = tableDao.findById(1);
            assertTrue(t1.isPresent());
            assertEquals("Bàn 01", t1.get().getName());

            Optional<Table> t99 = tableDao.findById(99);
            assertTrue(t99.isEmpty());
        }

        @Test
        @DisplayName("findByZone should filter tables by zone name")
        void testFindByZone() {
            List<Table> mainFloor = tableDao.findByZone("Main Floor");
            assertEquals(6, mainFloor.size());

            List<Table> patio = tableDao.findByZone("Patio");
            assertEquals(5, patio.size());

            List<Table> coffeeBar = tableDao.findByZone("Coffee Bar");
            assertEquals(4, coffeeBar.size());
        }

        @Test
        @DisplayName("findByStatus should filter tables by operational status")
        void testFindByStatus() {
            List<Table> occupied = tableDao.findByStatus(TableStatus.OCCUPIED);
            assertFalse(occupied.isEmpty());
            assertTrue(occupied.stream().allMatch(t -> t.getStatus() == TableStatus.OCCUPIED));
        }

        @Test
        @DisplayName("updateStatus should update table status and guest count")
        void testUpdateStatus() {
            boolean updated = tableDao.updateStatus(1, TableStatus.OCCUPIED, 2);
            assertTrue(updated);

            Table t1 = tableDao.findById(1).orElseThrow();
            assertEquals(TableStatus.OCCUPIED, t1.getStatus());
            assertEquals(2, t1.getGuestCount());
            assertNotNull(t1.getOccupiedSince());

            // Transition back to AVAILABLE
            tableDao.updateStatus(1, TableStatus.AVAILABLE, 0);
            Table t1Cleared = tableDao.findById(1).orElseThrow();
            assertEquals(TableStatus.AVAILABLE, t1Cleared.getStatus());
            assertEquals(0, t1Cleared.getGuestCount());
            assertNull(t1Cleared.getOccupiedSince());
        }

        @Test
        @DisplayName("save and deleteById should handle custom tables")
        void testSaveAndDeleteTable() {
            Table newTable = new Table(16, "Bàn VIP 16", 8, "VIP Lounge");
            assertTrue(tableDao.save(newTable));

            Optional<Table> saved = tableDao.findById(16);
            assertTrue(saved.isPresent());
            assertEquals("Bàn VIP 16", saved.get().getName());

            assertTrue(tableDao.deleteById(16));
            assertTrue(tableDao.findById(16).isEmpty());
        }
    }

    @Nested
    @DisplayName("Menu & Inventory DAO Tests")
    class MenuDaoTests {

        @Test
        @DisplayName("findAll should return pre-seeded items and findById should work")
        void testFindAllAndFindById() {
            List<MenuItem> items = menuDao.findAll();
            assertFalse(items.isEmpty());

            Optional<MenuItem> item1 = menuDao.findById(1);
            assertTrue(item1.isPresent());
            assertEquals("Cà phê Muối Đặc Biệt", item1.get().getName());
        }

        @Test
        @DisplayName("findByCategory should return items matching category")
        void testFindByCategory() {
            List<MenuItem> coffees = menuDao.findByCategory("Cà phê");
            assertFalse(coffees.isEmpty());
            assertTrue(coffees.stream().allMatch(i -> "Cà phê".equalsIgnoreCase(i.getCategory())));
        }

        @Test
        @DisplayName("toggleInStock should toggle availability")
        void testToggleInStock() {
            assertTrue(menuDao.toggleInStock(1, false));
            assertFalse(menuDao.findById(1).orElseThrow().isInStock());

            assertTrue(menuDao.toggleInStock(1, true));
            assertTrue(menuDao.findById(1).orElseThrow().isInStock());
        }

        @Test
        @DisplayName("save and deleteById should handle new menu items")
        void testSaveAndDeleteMenuItem() {
            MenuItem newItem = new MenuItem(null, "Trà Sen Vàng Đà Lạt", "Trà & Bánh", 52000.0, 19000.0);
            assertTrue(menuDao.save(newItem));
            assertNotNull(newItem.getId());

            Optional<MenuItem> retrieved = menuDao.findById(newItem.getId());
            assertTrue(retrieved.isPresent());
            assertEquals("Trà Sen Vàng Đà Lạt", retrieved.get().getName());

            assertTrue(menuDao.deleteById(newItem.getId()));
            assertTrue(menuDao.findById(newItem.getId()).isEmpty());
        }
    }

    @Nested
    @DisplayName("Order DAO Tests")
    class OrderDaoTests {

        @Test
        @DisplayName("findAll should return orders and findByOrderCode should find exact code")
        void testFindAllAndFindByCode() {
            List<Order> orders = orderDao.findAll();
            assertFalse(orders.isEmpty());

            Optional<Order> o1 = orderDao.findByOrderCode("AC-0051-A1B");
            assertTrue(o1.isPresent());
            assertEquals("Nguyễn Văn Hùng", o1.get().getCustomer());
        }

        @Test
        @DisplayName("findByStatus and findByTableId should filter correctly")
        void testFilterOrders() {
            List<Order> brewing = orderDao.findByStatus(OrderStatus.BREWING);
            assertFalse(brewing.isEmpty());
            assertEquals(OrderStatus.BREWING, brewing.get(0).getStatus());

            List<Order> table2Orders = orderDao.findByTableId(2);
            assertFalse(table2Orders.isEmpty());
            assertEquals(2, table2Orders.get(0).getTableId());
        }

        @Test
        @DisplayName("save new order should auto-generate id and code if omitted")
        void testSaveNewOrder() {
            Order order = new Order();
            order.setCustomer("Khách VIP B");
            order.setTableId(5);
            order.addItem(new OrderItem("Cà phê Trứng", 2, 45000.0));

            assertTrue(orderDao.save(order));
            assertNotNull(order.getId());
            assertNotNull(order.getOrderCode());
            assertTrue(order.getOrderCode().startsWith("AC-"));

            Optional<Order> retrieved = orderDao.findById(order.getId());
            assertTrue(retrieved.isPresent());
            assertEquals(90000.0, retrieved.get().getSubtotal(), 0.01);
        }

        @Test
        @DisplayName("updateStatus and updatePaymentStatus should update order state")
        void testUpdateOrderStatuses() {
            Order order = orderDao.findAll().get(0);
            int id = order.getId();

            assertTrue(orderDao.updateStatus(id, OrderStatus.READY));
            assertEquals(OrderStatus.READY, orderDao.findById(id).orElseThrow().getStatus());

            assertTrue(orderDao.updatePaymentStatus(id, PaymentStatus.PAID));
            assertEquals(PaymentStatus.PAID, orderDao.findById(id).orElseThrow().getPaymentStatus());
        }
    }

    @Nested
    @DisplayName("Reservation DAO Tests")
    class ReservationDaoTests {

        @Test
        @DisplayName("findAll and findByReservationCode should retrieve reservations")
        void testFindReservations() {
            List<Reservation> all = reservationDao.findAll();
            assertFalse(all.isEmpty());

            Optional<Reservation> res = reservationDao.findByReservationCode("RES-20261015-001");
            assertTrue(res.isPresent());
            assertEquals("Trần Minh Trí", res.get().getCustomer());
            assertEquals(4, res.get().getGuests());
        }

        @Test
        @DisplayName("save new reservation and updateStatus")
        void testSaveAndUpdateReservation() {
            Reservation r = new Reservation(null, null, "Đặng Văn Lâm", "0909090909", Instant.now().plusSeconds(3600), 6);
            r.setTableName("Bàn 05");
            r.setTableId(5);

            assertTrue(reservationDao.save(r));
            assertNotNull(r.getId());
            assertNotNull(r.getReservationCode());
            assertTrue(r.getReservationCode().startsWith("RES-"));

            assertTrue(reservationDao.updateStatus(r.getId(), ReservationStatus.CONFIRMED));
            assertEquals(ReservationStatus.CONFIRMED, reservationDao.findById(r.getId()).orElseThrow().getStatus());
        }
    }

    @Nested
    @DisplayName("Customer DAO Tests")
    class CustomerDaoTests {

        @Test
        @DisplayName("findByPhone and findByRank should work")
        void testFindCustomers() {
            Optional<Customer> c1 = customerDao.findByPhone("0901234567");
            assertTrue(c1.isPresent());
            assertEquals("Nguyễn Văn Hùng", c1.get().getName());

            List<Customer> vipList = customerDao.findByRank(CustomerRank.VIP);
            assertFalse(vipList.isEmpty());
            assertEquals(CustomerRank.VIP, vipList.get(0).getRank());
        }

        @Test
        @DisplayName("addOrderRecord should accumulate spend and auto-upgrade rank")
        void testAddOrderRecord() {
            Customer c = new Customer(null, "Khách Thử Nghiệm", "0999888777", "test@dalatcafe.com");
            assertTrue(customerDao.save(c));
            int id = c.getId();

            assertEquals(CustomerRank.BRONZE, customerDao.findById(id).orElseThrow().getRank());

            // Add order 700k -> upgrade to SILVER
            assertTrue(customerDao.addOrderRecord(id, 700000.0, 70));
            Customer silverCustomer = customerDao.findById(id).orElseThrow();
            assertEquals(CustomerRank.SILVER, silverCustomer.getRank());
            assertEquals(700000.0, silverCustomer.getTotalSpent());
            assertEquals(70, silverCustomer.getLoyaltyPoints());

            // Redeem 30 points
            assertTrue(customerDao.redeemPoints(id, 30));
            assertEquals(40, customerDao.findById(id).orElseThrow().getLoyaltyPoints());
        }

        @Test
        @DisplayName("restorePoints should give points back without counting a visit")
        void testRestorePoints() {
            Customer c = new Customer(null, "Khách Hoàn Điểm", "0999888666", null);
            assertTrue(customerDao.save(c));
            int id = c.getId();
            assertTrue(customerDao.addOrderRecord(id, 100000.0, 50));
            assertTrue(customerDao.redeemPoints(id, 50));

            assertTrue(customerDao.restorePoints(id, 20));
            assertFalse(customerDao.restorePoints(id, 0));
            assertFalse(customerDao.restorePoints(id, -5));
            assertFalse(customerDao.restorePoints(999999, 1), "unknown member");

            Customer after = customerDao.findById(id).orElseThrow();
            assertEquals(20, after.getLoyaltyPoints());
            assertEquals(1, after.getTotalOrders());
            assertEquals(100000.0, after.getTotalSpent());
        }

        @Test
        @DisplayName("concurrent earning and redeeming on one member should keep every change")
        void testConcurrentEarnAndRedeem() throws Exception {
            int workers = 4;
            int rounds = 20_000;
            Customer c = new Customer(null, "Khách Đồng Thời", "0999000111", null);
            assertTrue(customerDao.save(c));
            int id = c.getId();
            int opening = workers * rounds;
            assertTrue(customerDao.addOrderRecord(id, 0, opening));

            List<Runnable> tasks = new ArrayList<>();
            for (int w = 0; w < workers; w++) {
                tasks.add(() -> {
                    for (int i = 0; i < rounds; i++) {
                        customerDao.addOrderRecord(id, 1, 1);
                    }
                });
                tasks.add(() -> {
                    for (int i = 0; i < rounds; i++) {
                        assertTrue(customerDao.redeemPoints(id, 1));
                    }
                });
            }
            Concurrently.run(tasks);

            Customer after = customerDao.findById(id).orElseThrow();
            assertEquals(opening, after.getLoyaltyPoints(), "every earned and redeemed point is counted");
            assertEquals(1 + workers * rounds, after.getTotalOrders());
            assertEquals(workers * rounds, after.getTotalSpent());
        }
    }

    @Nested
    @DisplayName("DaoFactory & JDBC Zero-Crash Fallback Tests")
    class DaoFactoryTests {

        @Test
        @DisplayName("DaoFactory singleton should provide functional DAOs")
        void testDaoFactoryInstance() {
            DaoFactory factory = DaoFactory.getInstance();
            assertNotNull(factory);
            assertNotNull(factory.getTableDao());
            assertNotNull(factory.getMenuDao());
            assertNotNull(factory.getOrderDao());
            assertNotNull(factory.getReservationDao());
            assertNotNull(factory.getCustomerDao());
        }

        @Test
        @DisplayName("DaoFactory should safely remain in IN_MEMORY when JDBC is unavailable")
        void testSafeFallback() {
            DaoFactory factory = DaoFactory.getInstance();
            factory.setMode(DaoMode.JDBC); // When offline, this should safely fallback to IN_MEMORY
            assertNotNull(factory.getTableDao());
            // System should not crash
            assertFalse(factory.getTableDao().findAll().isEmpty());
        }

        @Test
        @DisplayName("JdbcDatabase isAvailable should return boolean safely without unhandled exceptions")
        void testJdbcAvailabilitySafety() {
            assertDoesNotThrow(() -> {
                boolean available = JdbcDatabase.isAvailable();
                // In CI / test environment without live PostgreSQL, it should safely return false without exception
                assertFalse(available);
            });
        }
    }
}

