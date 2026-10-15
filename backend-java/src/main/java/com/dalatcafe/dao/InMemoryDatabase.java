package com.dalatcafe.dao;

import com.dalatcafe.model.*;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Thread-safe In-Memory Data Store providing zero-crash offline execution
 * and fast, idempotent unit test environments.
 */
public class InMemoryDatabase {
    private static volatile InMemoryDatabase instance;

    private final Map<Integer, Table> tables = new ConcurrentHashMap<>();
    private final Map<Integer, MenuItem> menuItems = new ConcurrentHashMap<>();
    private final Map<Integer, Order> orders = new ConcurrentHashMap<>();
    private final Map<Integer, Reservation> reservations = new ConcurrentHashMap<>();
    private final Map<Integer, Customer> customers = new ConcurrentHashMap<>();

    private final AtomicInteger nextOrderId = new AtomicInteger(100);
    private final AtomicInteger nextReservationId = new AtomicInteger(10);
    private final AtomicInteger nextCustomerId = new AtomicInteger(10);
    private final AtomicInteger nextMenuItemId = new AtomicInteger(50);

    private InMemoryDatabase() {
        seedInitialData();
    }

    public static InMemoryDatabase getInstance() {
        if (instance == null) {
            synchronized (InMemoryDatabase.class) {
                if (instance == null) {
                    instance = new InMemoryDatabase();
                }
            }
        }
        return instance;
    }

    /**
     * Resets the store and re-seeds with clean baseline data (for test isolation).
     */
    public synchronized void reset() {
        tables.clear();
        menuItems.clear();
        orders.clear();
        reservations.clear();
        customers.clear();
        nextOrderId.set(100);
        nextReservationId.set(10);
        nextCustomerId.set(10);
        nextMenuItemId.set(50);
        seedInitialData();
    }

    private void seedInitialData() {
        seedTables();
        seedMenuItems();
        seedCustomers();
        seedReservations();
        seedSampleOrders();
    }

    private void seedTables() {
        // 15 Physical Tables matching docs/DATABASE.md and mock-store.ts
        addTable(new Table(1, "Bàn 01", 2, "Main Floor", TableStatus.AVAILABLE, 0));
        addTable(new Table(2, "Bàn 02", 4, "Main Floor", TableStatus.OCCUPIED, 3));
        addTable(new Table(3, "Bàn 03", 4, "Main Floor", TableStatus.AVAILABLE, 0));
        addTable(new Table(4, "Bàn 04", 2, "Main Floor", TableStatus.RESERVED, 2));
        addTable(new Table(5, "Bàn 05", 6, "Main Floor", TableStatus.AVAILABLE, 0));
        addTable(new Table(6, "Bàn 06", 4, "Main Floor", TableStatus.AVAILABLE, 0));
        addTable(new Table(7, "Bàn 07", 4, "Patio", TableStatus.OCCUPIED, 4));
        addTable(new Table(8, "Bàn 08", 2, "Patio", TableStatus.CLEANING, 0));
        addTable(new Table(9, "Bàn 09", 4, "Patio", TableStatus.AVAILABLE, 0));
        addTable(new Table(10, "Bàn 10", 2, "Patio", TableStatus.AVAILABLE, 0));
        addTable(new Table(11, "Bàn 11", 2, "Patio", TableStatus.RESERVED, 2));
        addTable(new Table(12, "Bàn 12", 1, "Coffee Bar", TableStatus.AVAILABLE, 0));
        addTable(new Table(13, "Bàn 13", 1, "Coffee Bar", TableStatus.OCCUPIED, 1));
        addTable(new Table(14, "Bàn 14", 1, "Coffee Bar", TableStatus.AVAILABLE, 0));
        addTable(new Table(15, "Bàn 15", 1, "Coffee Bar", TableStatus.AVAILABLE, 0));
    }

    private void addTable(Table table) {
        tables.put(table.getId(), table);
    }

    private void seedMenuItems() {
        // Menu item 1: Ca phe Muoi
        MenuItem item1 = new MenuItem(1, "Cà phê Muối Đặc Biệt", "Cà phê", 45000.0, 15000.0, 85.0);
        item1.setRecipe("Cà phê pha phin truyền thống kết hợp lớp kem mặn béo ngậy.");
        item1.addVariation(new Variation("Nóng", 0.0));
        item1.addVariation(new Variation("Đá", 0.0));
        menuItems.put(1, item1);

        // Menu item 2: Latte Vani
        MenuItem item2 = new MenuItem(2, "Cà phê Latte Vani Mịn", "Cà phê", 55000.0, 18000.0, 45.0);
        item2.setRecipe("Double shot espresso, siro vani và sữa tươi thanh trùng.");
        item2.addVariation(new Variation("Sữa tươi", 0.0));
        item2.addVariation(new Variation("Sữa yến mạch", 10000.0));
        menuItems.put(2, item2);

        // Menu item 3: Bac Xiu
        MenuItem item3 = new MenuItem(3, "Bạc Xỉu Sữa Tươi", "Cà phê", 45000.0, 16000.0, 32.0);
        item3.setRecipe("Nhiều sữa ít cà phê, béo ngậy chuẩn vị Sài Gòn.");
        item3.addVariation(new Variation("Nóng", 0.0));
        item3.addVariation(new Variation("Đá", 0.0));
        menuItems.put(3, item3);

        // Menu item 4: Cold Brew Cam Vang
        MenuItem item4 = new MenuItem(4, "Cold Brew Cam Vàng", "Cà phê ủ lạnh", 55000.0, 20000.0, 28.0);
        item4.setRecipe("Cà phê ủ lạnh 16h kết hợp lát cam vàng mọng nước.");
        menuItems.put(4, item4);

        // Menu item 5: Tra Dao Cam Sa
        MenuItem item5 = new MenuItem(5, "Trà Đào Cam Sả", "Trà & Bánh", 50000.0, 18000.0, 24.0);
        item5.setRecipe("Trà đen thơm mát kết hợp miếng đào tươi giòn và sả đập dập.");
        menuItems.put(5, item5);

        // Menu item 6: Banh Croissant
        MenuItem item6 = new MenuItem(6, "Bánh Croissant Bơ Tỏi", "Trà & Bánh", 35000.0, 12000.0, 8.0); // Low stock
        item6.setLowStockThreshold(10.0);
        item6.setUnit("cái");
        menuItems.put(6, item6);
    }

    private void seedCustomers() {
        Customer c1 = new Customer(1, "Nguyễn Văn Hùng", "0901234567", "hung.nguyen@example.com");
        c1.addOrderRecord(600000.0, 60); // Silver
        customers.put(1, c1);

        Customer c2 = new Customer(2, "Lê Thị Mai", "0912345678", "mai.le@example.com");
        c2.addOrderRecord(2500000.0, 250); // Gold
        customers.put(2, c2);

        Customer c3 = new Customer(3, "Phạm Quốc Tuấn", "0987654321", "tuan.pham@example.com");
        c3.addOrderRecord(5500000.0, 550); // VIP
        customers.put(3, c3);
    }

    private void seedReservations() {
        Reservation r1 = new Reservation(1, "RES-20261015-001", "Trần Minh Trí", "0933112233", Instant.now().plusSeconds(3600), 4);
        r1.setTableName("Bàn 04");
        r1.setTableId(4);
        r1.setStatus(ReservationStatus.CONFIRMED);
        r1.setNote("Gần cửa sổ, chuẩn bị thêm ghế trẻ em");
        r1.addPreOrder(new OrderItem(1, "Cà phê Muối Đặc Biệt", 2, 45000.0, "Đá", null));
        reservations.put(1, r1);

        Reservation r2 = new Reservation(2, "RES-20261015-002", "Hoàng Kim Ngân", "0944556677", Instant.now().plusSeconds(7200), 2);
        r2.setTableName("Bàn 11");
        r2.setTableId(11);
        r2.setStatus(ReservationStatus.PENDING);
        reservations.put(2, r2);
    }

    private void seedSampleOrders() {
        Order o1 = new Order(1, "AC-0051-A1B", "Nguyễn Văn Hùng", 2, OrderType.DINE_IN);
        o1.addItem(new OrderItem(1, "Cà phê Muối Đặc Biệt", 2, 45000.0, "Đá", null));
        o1.addItem(new OrderItem(6, "Bánh Croissant Bơ Tỏi", 1, 35000.0, null, null));
        o1.setPaymentMethod(PaymentMethod.QR);
        o1.setPaymentStatus(PaymentStatus.PAID);
        o1.setStatus(OrderStatus.BREWING);
        orders.put(1, o1);

        Order o2 = new Order(2, "AC-0052-C3D", "Walk-in Guest", 7, OrderType.DINE_IN);
        o2.addItem(new OrderItem(2, "Cà phê Latte Vani Mịn", 1, 55000.0, "Sữa tươi", null));
        o2.addItem(new OrderItem(4, "Cold Brew Cam Vàng", 1, 55000.0, null, null));
        o2.setPaymentMethod(PaymentMethod.CASH);
        o2.setPaymentStatus(PaymentStatus.UNPAID);
        o2.setStatus(OrderStatus.PENDING);
        orders.put(2, o2);
    }

    public Map<Integer, Table> getTables() {
        return tables;
    }

    public Map<Integer, MenuItem> getMenuItems() {
        return menuItems;
    }

    public Map<Integer, Order> getOrders() {
        return orders;
    }

    public Map<Integer, Reservation> getReservations() {
        return reservations;
    }

    public Map<Integer, Customer> getCustomers() {
        return customers;
    }

    public int generateOrderId() {
        return nextOrderId.getAndIncrement();
    }

    public int generateReservationId() {
        return nextReservationId.getAndIncrement();
    }

    public int generateCustomerId() {
        return nextCustomerId.getAndIncrement();
    }

    public int generateMenuItemId() {
        return nextMenuItemId.getAndIncrement();
    }
}

