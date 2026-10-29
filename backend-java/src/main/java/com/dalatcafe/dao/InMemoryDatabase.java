package com.dalatcafe.dao;

import com.dalatcafe.model.*;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Kho dữ liệu trong bộ nhớ an toàn đa luồng, giúp chạy offline không sập và tạo môi trường unit
 * test nhanh, lặp lại được.
 */
public class InMemoryDatabase {
    private static volatile InMemoryDatabase instance;

    private final Map<Integer, Table> tables = new ConcurrentHashMap<>();
    private final Map<Integer, MenuItem> menuItems = new ConcurrentHashMap<>();
    private final Map<Integer, Order> orders = new ConcurrentHashMap<>();
    private final Map<Integer, Reservation> reservations = new ConcurrentHashMap<>();
    private final Map<Integer, Customer> customers = new ConcurrentHashMap<>();
    private final Map<Integer, UserAccount> users = new ConcurrentHashMap<>();
    private final Map<Integer, Voucher> vouchers = new ConcurrentHashMap<>();
    private final Map<Integer, VoucherUsage> voucherUsages = new ConcurrentHashMap<>();

    private final AtomicInteger nextVoucherId = new AtomicInteger(1);
    private final AtomicInteger nextVoucherUsageId = new AtomicInteger(1);
    private final AtomicInteger nextOrderId = new AtomicInteger(100);
    private final AtomicInteger nextReservationId = new AtomicInteger(10);
    private final AtomicInteger nextCustomerId = new AtomicInteger(10);
    private final AtomicInteger nextMenuItemId = new AtomicInteger(50);
    private final AtomicInteger nextUserId = new AtomicInteger(1);

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
     * Xóa kho và nạp lại dữ liệu mẫu sạch (để các test độc lập với nhau).
     */
    public synchronized void reset() {
        tables.clear();
        menuItems.clear();
        orders.clear();
        reservations.clear();
        customers.clear();
        users.clear();
        vouchers.clear();
        voucherUsages.clear();
        nextVoucherId.set(1);
        nextVoucherUsageId.set(1);
        nextOrderId.set(100);
        nextReservationId.set(10);
        nextCustomerId.set(10);
        nextMenuItemId.set(50);
        nextUserId.set(1);
        seedInitialData();
    }

    /**
     * WELCOME10: không giới hạn tổng, mỗi tài khoản một lần, chỉ cho đơn online đầu tiên. Dùng
     * chung cho kho trong bộ nhớ và lần seed PostgreSQL đầu tiên.
     */
    public static Voucher welcomeVoucher() {
        Voucher welcome = new Voucher();
        welcome.setCode("WELCOME10");
        welcome.setType(VoucherType.PERCENT);
        welcome.setValue(10);
        welcome.setMaxDiscount(50_000.0);
        welcome.setPerAccountLimit(1);
        welcome.setFirstOnlineOrderOnly(true);
        welcome.setStartDate(java.time.LocalDate.of(2026, 1, 1));
        welcome.setEndDate(java.time.LocalDate.of(2099, 12, 31));
        welcome.setDescription("Giảm 10% cho đơn online đầu tiên (tối đa 50.000 đ)");
        welcome.setActive(true);
        return welcome;
    }

    private void seedVouchers() {
        Voucher welcome = welcomeVoucher();
        welcome.setId(nextVoucherId.getAndIncrement());
        vouchers.put(welcome.getId(), welcome);
    }

    private void seedInitialData() {
        seedVouchers();
        seedTables();
        seedMenuItems();
        seedCustomers();
        seedReservations();
        seedSampleOrders();
    }

    private void seedTables() {
        // 15 bàn thật, khớp docs/DATABASE.md và mock-store.ts
        Table t1 = new Table(1, "Bàn 01", 2, "Main Floor", TableStatus.AVAILABLE, 0);
        t1.setImageUrl("/images/catalog/photo-1554118811-1e0d58224f24.jpg");
        addTable(t1);

        Table t2 = new Table(2, "Bàn 02", 4, "Main Floor", TableStatus.OCCUPIED, 3);
        t2.setImageUrl("/images/catalog/photo-1521017432531-fbd92d768814.jpg");
        addTable(t2);

        Table t3 = new Table(3, "Bàn 03", 4, "Main Floor", TableStatus.AVAILABLE, 0);
        t3.setImageUrl("/images/catalog/photo-1442512595331-e89e73853f31.jpg");
        addTable(t3);

        Table t4 = new Table(4, "Bàn 04", 2, "Main Floor", TableStatus.RESERVED, 2);
        t4.setImageUrl("/images/catalog/photo-1559925393-8be0ec4767c8.jpg");
        addTable(t4);

        Table t5 = new Table(5, "Bàn 05", 6, "Main Floor", TableStatus.AVAILABLE, 0);
        t5.setImageUrl("/images/catalog/photo-1600093463592-8e36ae95ef56.jpg");
        addTable(t5);

        Table t6 = new Table(6, "Bàn 06", 4, "Main Floor", TableStatus.AVAILABLE, 0);
        t6.setImageUrl("/images/catalog/photo-1511920170033-f8396924c348.jpg");
        addTable(t6);

        Table t7 = new Table(7, "Bàn 07", 4, "Patio", TableStatus.OCCUPIED, 4);
        t7.setImageUrl("/images/catalog/photo-1517248135467-4c7edcad34c4.jpg");
        addTable(t7);

        Table t8 = new Table(8, "Bàn 08", 2, "Patio", TableStatus.CLEANING, 0);
        t8.setImageUrl("/images/catalog/photo-1525610553991-2bede1a236e2.jpg");
        addTable(t8);

        Table t9 = new Table(9, "Bàn 09", 4, "Patio", TableStatus.AVAILABLE, 0);
        t9.setImageUrl("/images/catalog/photo-1501339847302-ac426a4a7cbb.jpg");
        addTable(t9);

        Table t10 = new Table(10, "Bàn 10", 2, "Patio", TableStatus.AVAILABLE, 0);
        t10.setImageUrl("/images/catalog/photo-1508766917616-d22f3f1eea14.jpg");
        addTable(t10);

        Table t11 = new Table(11, "Bàn 11", 2, "Patio", TableStatus.RESERVED, 2);
        t11.setImageUrl("/images/catalog/photo-1447933601403-0c6688de566e.jpg");
        addTable(t11);

        Table t12 = new Table(12, "Bàn 12", 1, "Coffee Bar", TableStatus.AVAILABLE, 0);
        t12.setImageUrl("/images/catalog/photo-1501386761578-eac5c94b800a.jpg");
        addTable(t12);

        Table t13 = new Table(13, "Bàn 13", 1, "Coffee Bar", TableStatus.OCCUPIED, 1);
        t13.setImageUrl("/images/space/counter.jpg");
        addTable(t13);

        Table t14 = new Table(14, "Bàn 14", 1, "Coffee Bar", TableStatus.AVAILABLE, 0);
        t14.setImageUrl("/images/catalog/photo-1498804103079-a6351b050096.jpg");
        addTable(t14);

        Table t15 = new Table(15, "Bàn 15", 1, "Coffee Bar", TableStatus.AVAILABLE, 0);
        t15.setImageUrl("/images/catalog/photo-1495474472287-4d71bcdd2085.jpg");
        addTable(t15);

        branchTwoTables(16).forEach(this::addTable);
    }

    /**
     * Sơ đồ bàn của 456 Bùi Thị Xuân, đánh số từ {@code firstId}. Cũng dùng để nạp bàn cho một sơ
     * đồ PostgreSQL có từ trước khi có chi nhánh, nơi các id từ 16 trở đi có thể đã bị dùng.
     */
    public static java.util.List<Table> branchTwoTables(int firstId) {
        Object[][] rows = {
                {"Bàn 01", 2, "Sân vườn", "/images/catalog/photo-1517248135467-4c7edcad34c4.jpg"},
                {"Bàn 02", 4, "Sân vườn", "/images/catalog/photo-1525610553991-2bede1a236e2.jpg"},
                {"Bàn 03", 4, "Sân vườn", "/images/catalog/photo-1501339847302-ac426a4a7cbb.jpg"},
                {"Bàn 04", 6, "Sân vườn", "/images/catalog/photo-1508766917616-d22f3f1eea14.jpg"},
                {"Bàn 05", 2, "Góc làm việc", "/images/catalog/photo-1497636577773-f1231844b336.jpg"},
                {"Bàn 06", 2, "Góc làm việc", "/images/catalog/photo-1521017432531-fbd92d768814.jpg"},
                {"Bàn 07", 4, "Tầng 2", "/images/catalog/photo-1495474472287-4d71bcdd2085.jpg"},
                {"Bàn 08", 4, "Tầng 2", "/images/catalog/photo-1554118811-1e0d58224f24.jpg"},
        };
        java.util.List<Table> tables = new java.util.ArrayList<>();
        for (int i = 0; i < rows.length; i++) {
            Table table = new Table(firstId + i, (String) rows[i][0], (Integer) rows[i][1], (String) rows[i][2]);
            table.setBranch(Branches.BUI_THI_XUAN);
            table.setImageUrl((String) rows[i][3]);
            tables.add(table);
        }
        return tables;
    }

    private void addTable(Table table) {
        tables.put(table.getId(), table);
    }

    private void seedMenuItems() {
        // Món 1: Cà phê Muối
        MenuItem item1 = new MenuItem(1, "Cà phê Muối Đặc Biệt", "Cà phê", 45000.0, 15000.0);
        item1.setRecipe("Cà phê pha phin truyền thống kết hợp lớp kem mặn béo ngậy.");
        item1.setImageUrl("/images/catalog/photo-1514432324607-a09d9b4aefdd.jpg");
        item1.addVariation(new Variation("Nóng", 0.0));
        item1.addVariation(new Variation("Đá", 0.0));
        menuItems.put(1, item1);

        // Món 2: Latte Vani
        MenuItem item2 = new MenuItem(2, "Cà phê Latte Vani Mịn", "Cà phê", 55000.0, 18000.0);
        item2.setRecipe("Double shot espresso, siro vani và sữa tươi thanh trùng.");
        item2.setImageUrl("/images/catalog/photo-1534778101976-62847782c213.jpg");
        item2.addVariation(new Variation("Sữa tươi", 0.0));
        item2.addVariation(new Variation("Sữa yến mạch", 10000.0));
        menuItems.put(2, item2);

        // Món 3: Bạc Xỉu
        MenuItem item3 = new MenuItem(3, "Bạc Xỉu Sữa Tươi", "Cà phê", 45000.0, 16000.0);
        item3.setRecipe("Nhiều sữa ít cà phê, béo ngậy chuẩn vị Sài Gòn.");
        item3.setImageUrl("/images/catalog/photo-1517256064527-09c73fc73e38.jpg");
        item3.addVariation(new Variation("Nóng", 0.0));
        item3.addVariation(new Variation("Đá", 0.0));
        menuItems.put(3, item3);

        // Món 4: Cold Brew Cam Vàng
        MenuItem item4 = new MenuItem(4, "Cold Brew Cam Vàng", "Cà phê ủ lạnh", 55000.0, 20000.0);
        item4.setRecipe("Cà phê ủ lạnh 16h kết hợp lát cam vàng mọng nước.");
        item4.setImageUrl("/images/catalog/photo-1517701550927-30cf4ba1dba5.jpg");
        menuItems.put(4, item4);

        // Món 5: Trà Đào Cam Sả
        MenuItem item5 = new MenuItem(5, "Trà Đào Cam Sả", "Trà & Bánh", 50000.0, 18000.0);
        item5.setRecipe("Trà đen thơm mát kết hợp miếng đào tươi giòn và sả đập dập.");
        item5.setImageUrl("/images/catalog/photo-1556679343-c7306c1976bc.jpg");
        menuItems.put(5, item5);

        // Món 6: Bánh Croissant
        MenuItem item6 = new MenuItem(6, "Bánh Croissant Bơ Tỏi", "Trà & Bánh", 35000.0, 12000.0);
        item6.setImageUrl("/images/catalog/photo-1555507036-ab1f4038808a.jpg");
        item6.setUnit("cái");
        menuItems.put(6, item6);
    }

    private void seedCustomers() {
        Customer c1 = new Customer(1, "Nguyễn Văn Hùng", "0901234567", "hung.nguyen@example.com");
        c1.addOrderRecord(600000.0, 60); // Bạc
        customers.put(1, c1);

        Customer c2 = new Customer(2, "Lê Thị Mai", "0912345678", "mai.le@example.com");
        c2.addOrderRecord(2500000.0, 250); // Vàng
        customers.put(2, c2);

        Customer c3 = new Customer(3, "Phạm Quốc Tuấn", "0987654321", "tuan.pham@example.com");
        c3.addOrderRecord(5500000.0, 550); // Kim cương (VIP)
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

    public Map<Integer, Voucher> getVouchers() {
        return vouchers;
    }

    public Map<Integer, VoucherUsage> getVoucherUsages() {
        return voucherUsages;
    }

    public int generateVoucherId() {
        return nextVoucherId.getAndIncrement();
    }

    public int generateVoucherUsageId() {
        return nextVoucherUsageId.getAndIncrement();
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

    /**
     * Không nạp sẵn tài khoản nào: server tự tạo quản trị viên đầu tiên khi khởi động
     * (AdminBootstrap).
     */
    public Map<Integer, UserAccount> getUsers() {
        return users;
    }

    public int generateUserId() {
        return nextUserId.getAndIncrement();
    }
}

