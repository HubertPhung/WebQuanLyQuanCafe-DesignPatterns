package com.dalatcafe.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Đà Lạt Cafe - Core Model Entities & Enums Unit Tests")
class ModelEntitiesTest {

    @Nested
    @DisplayName("Domain Enums Tests")
    class EnumsTest {

        @ParameterizedTest
        @EnumSource(OrderStatus.class)
        @DisplayName("OrderStatus enum should have non-null description")
        void orderStatus_should_have_description(OrderStatus status) {
            assertNotNull(status.getDescription());
            assertFalse(status.getDescription().isBlank());
        }

        @ParameterizedTest
        @EnumSource(TableStatus.class)
        @DisplayName("TableStatus enum should have non-null description")
        void tableStatus_should_have_description(TableStatus status) {
            assertNotNull(status.getDescription());
            assertFalse(status.getDescription().isBlank());
        }

        @ParameterizedTest
        @EnumSource(PaymentMethod.class)
        @DisplayName("PaymentMethod enum should have non-null description")
        void paymentMethod_should_have_description(PaymentMethod method) {
            assertNotNull(method.getDescription());
            assertFalse(method.getDescription().isBlank());
        }

        @ParameterizedTest
        @EnumSource(PaymentStatus.class)
        @DisplayName("PaymentStatus enum should have non-null description")
        void paymentStatus_should_have_description(PaymentStatus status) {
            assertNotNull(status.getDescription());
            assertFalse(status.getDescription().isBlank());
        }

        @ParameterizedTest
        @EnumSource(OrderType.class)
        @DisplayName("OrderType enum should have non-null description")
        void orderType_should_have_description(OrderType type) {
            assertNotNull(type.getDescription());
            assertFalse(type.getDescription().isBlank());
        }

        @ParameterizedTest
        @EnumSource(ReservationStatus.class)
        @DisplayName("ReservationStatus enum should have non-null description")
        void reservationStatus_should_have_description(ReservationStatus status) {
            assertNotNull(status.getDescription());
            assertFalse(status.getDescription().isBlank());
        }

        @ParameterizedTest
        @CsvSource({
                "BRONZE, 0.0",
                "SILVER, 0.05",
                "GOLD, 0.10",
                "VIP, 0.15"
        })
        @DisplayName("CustomerRank enum should have expected discount rates")
        void customerRank_should_have_correct_discount_rate(CustomerRank rank, double expectedRate) {
            assertEquals(expectedRate, rank.getDiscountRate(), 0.001);
            assertNotNull(rank.getDescription());
        }
    }

    @Nested
    @DisplayName("Variation Entity Tests")
    class VariationTest {

        @Test
        @DisplayName("Should create variation and support getters/setters and equality")
        void testVariationProperties() {
            Variation v1 = new Variation("Nóng", 0.0);
            Variation v2 = new Variation("Nóng", 0.0);
            Variation v3 = new Variation("Size L", 10000.0);

            assertAll(
                    () -> assertEquals("Nóng", v1.getName()),
                    () -> assertEquals(0.0, v1.getPrice()),
                    () -> assertEquals(v1, v2),
                    () -> assertEquals(v1.hashCode(), v2.hashCode()),
                    () -> assertNotEquals(v1, v3),
                    () -> assertTrue(v1.toString().contains("Nóng"))
            );

            v1.setName("Size M");
            v1.setPrice(5000.0);
            assertEquals("Size M", v1.getName());
            assertEquals(5000.0, v1.getPrice());
        }
    }

    @Nested
    @DisplayName("OrderItem Entity Tests")
    class OrderItemTest {

        @Test
        @DisplayName("Should correctly calculate line total and enforce minimum quantity")
        void testOrderItemLineTotalAndQty() {
            OrderItem item = new OrderItem(1, "Cà Phê Trứng Đà Lạt", 2, 45000.0, "Nóng", "Ít đường");

            assertAll(
                    () -> assertEquals(1, item.getMenuItemId()),
                    () -> assertEquals("Cà Phê Trứng Đà Lạt", item.getName()),
                    () -> assertEquals(2, item.getQty()),
                    () -> assertEquals(45000.0, item.getPrice()),
                    () -> assertEquals("Nóng", item.getVariation()),
                    () -> assertEquals("Ít đường", item.getNotes()),
                    () -> assertEquals(90000.0, item.getLineTotal())
            );

            // Chặn số lượng tối thiểu
            item.setQty(0);
            assertEquals(1, item.getQty());
            assertEquals(45000.0, item.getLineTotal());

            item.setQty(-5);
            assertEquals(1, item.getQty());

            item.setQty(3);
            assertEquals(135000.0, item.getLineTotal());
        }

        @Test
        @DisplayName("Should support constructors and equality")
        void testOrderItemConstructorsAndEquality() {
            OrderItem item1 = new OrderItem("Espresso", 1, 35000.0);
            OrderItem item2 = new OrderItem("Espresso", 1, 35000.0, null);

            assertEquals(item1, item2);
            assertEquals(item1.hashCode(), item2.hashCode());
            assertTrue(item1.toString().contains("Espresso"));
        }
    }

    @Nested
    @DisplayName("Table Entity Tests")
    class TableTest {

        @Test
        @DisplayName("Should initialize default values correctly")
        void testTableDefaults() {
            Table table = new Table();

            assertEquals(2, table.getSeats());
            assertEquals("Main", table.getZone());
            assertEquals(TableStatus.AVAILABLE, table.getStatus());
            assertEquals(0, table.getGuestCount());
            assertNull(table.getOccupiedSince());
            assertNotNull(table.getUpdatedAt());
        }

        @Test
        @DisplayName("Should transition status and manage occupied timestamp")
        void testTableStatusTransitions() {
            Table table = new Table(1, "Bàn 01", 4, "Tầng 1");

            assertEquals(1, table.getId());
            assertEquals("Bàn 01", table.getName());
            assertEquals(4, table.getSeats());
            assertEquals("Tầng 1", table.getZone());

            // Chuyển sang OCCUPIED
            table.setStatus(TableStatus.OCCUPIED);
            table.setGuestCount(3);
            assertEquals(TableStatus.OCCUPIED, table.getStatus());
            assertNotNull(table.getOccupiedSince());
            assertEquals(3, table.getGuestCount());

            // Chuyển sang AVAILABLE (xóa occupiedSince và guestCount)
            table.setStatus(TableStatus.AVAILABLE);
            assertEquals(TableStatus.AVAILABLE, table.getStatus());
            assertNull(table.getOccupiedSince());
            assertEquals(0, table.getGuestCount());
        }

        @Test
        @DisplayName("Table equality based on ID")
        void testTableEquality() {
            Table t1 = new Table(1, "Bàn 1", 2, "A");
            Table t2 = new Table(1, "Bàn 1 - Mới", 4, "B");
            Table t3 = new Table(2, "Bàn 2", 2, "A");

            assertEquals(t1, t2);
            assertEquals(t1.hashCode(), t2.hashCode());
            assertNotEquals(t1, t3);
            assertTrue(t1.toString().contains("Bàn 1"));
        }
    }

    @Nested
    @DisplayName("MenuItem Entity Tests")
    class MenuItemTest {

        @Test
        @DisplayName("A new item is on sale until it is switched off")
        void testInStockSwitch() {
            MenuItem item = new MenuItem(1, "Hạt Cà Phê Cầu Đất Arabica", "Cà Phê", 85000.0, 45000.0);

            assertTrue(item.isInStock());
            item.setInStock(false);
            assertFalse(item.isInStock());
        }

        @Test
        @DisplayName("Should manage variations safely with defensive copying")
        void testMenuItemVariations() {
            MenuItem item = new MenuItem(2, "Latte Đà Lạt Sương Mù", "Cà Phê", 55000.0, 25000.0);

            item.addVariation(new Variation("Nóng", 0.0));
            item.addVariation(new Variation("Đá", 0.0));
            item.addVariation(new Variation("Size L", 10000.0));

            assertEquals(3, item.getVariations().size());

            // Danh sách trả về phải không sửa được
            assertThrows(UnsupportedOperationException.class, () ->
                    item.getVariations().add(new Variation("Extra shot", 15000.0))
            );

            // setVariations tạo bản sao phòng vệ
            List<Variation> externalList = List.of(new Variation("Mặc định", 0.0));
            item.setVariations(externalList);
            assertEquals(1, item.getVariations().size());
            assertEquals("Mặc định", item.getVariations().get(0).getName());
        }

        @Test
        @DisplayName("MenuItem getters, setters, and equality")
        void testMenuItemProperties() {
            MenuItem item1 = new MenuItem(10, "Bạc Xỉu", "Cà Phê", 39000.0, 15000.0);
            MenuItem item2 = new MenuItem(10, "Bạc Xỉu Đà Lạt", "Cà Phê", 42000.0, 15000.0);
            MenuItem item3 = new MenuItem(11, "Americano", "Cà Phê", 35000.0, 12000.0);

            item1.setRecipe("1 shot espresso, sữa đặc, sữa tươi");
            item1.setImageUrl("/images/bac-xiu.jpg");
            item1.setUnit("ly");
            item1.setKind("menu");

            assertAll(
                    () -> assertEquals("1 shot espresso, sữa đặc, sữa tươi", item1.getRecipe()),
                    () -> assertEquals("/images/bac-xiu.jpg", item1.getImageUrl()),
                    () -> assertEquals("ly", item1.getUnit()),
                    () -> assertEquals("menu", item1.getKind()),
                    () -> assertEquals(item1, item2),
                    () -> assertEquals(item1.hashCode(), item2.hashCode()),
                    () -> assertNotEquals(item1, item3),
                    () -> assertTrue(item1.toString().contains("Bạc Xỉu"))
            );
        }
    }

    @Nested
    @DisplayName("Order Entity Tests")
    class OrderTest {

        @Test
        @DisplayName("Should accurately calculate subtotal, 8% VAT, and total with discounts")
        void testOrderTotalCalculation() {
            Order order = new Order(101, "ORD-20261015-001", "Nguyễn Văn A", 3, OrderType.DINE_IN);

            order.addItem(new OrderItem(1, "Cà Phê Muối Biển", 2, 45000.0, null, null)); // 90,000
            order.addItem(new OrderItem(2, "Bánh Croissant Bơ Tỏi", 1, 35000.0, null, null)); // 35,000

            // Tạm tính = 125.000
            assertEquals(125000.0, order.getSubtotal(), 0.01);
            // VAT mặc định 8% trên 125.000 = 10.000
            assertEquals(10000.0, order.getVatAmount(), 0.01);
            // Tổng = 125.000 + 10.000 = 135.000
            assertEquals(135000.0, order.getTotal(), 0.01);

            // Áp giảm giá 25.000
            order.setDiscountAmount(25000.0);
            // Sau giảm giá: 100.000; VAT 8% trên 100.000 = 8.000; Tổng = 100.000 + 8.000 = 108.000
            assertEquals(125000.0, order.getSubtotal(), 0.01);
            assertEquals(25000.0, order.getDiscountAmount(), 0.01);
            assertEquals(8000.0, order.getVatAmount(), 0.01);
            assertEquals(108000.0, order.getTotal(), 0.01);
        }

        @Test
        @DisplayName("Should update completedAt timestamp when transitioning to COMPLETED")
        void testOrderCompletionTimestamp() {
            Order order = new Order();
            assertNull(order.getCompletedAt());

            order.setStatus(OrderStatus.BREWING);
            assertNull(order.getCompletedAt());

            order.setStatus(OrderStatus.COMPLETED);
            assertNotNull(order.getCompletedAt());
        }

        @Test
        @DisplayName("Order items list should be immutable and protected from external modification")
        void testOrderItemsEncapsulation() {
            Order order = new Order();
            order.addItem(new OrderItem("Trà Oolong Dã Quỳ", 1, 40000.0));

            assertThrows(UnsupportedOperationException.class, () ->
                    order.getItems().add(new OrderItem("Thêm món", 1, 10000.0))
            );
        }

        @Test
        @DisplayName("Order equality follows the unique orderCode and agrees with hashCode")
        void testOrderEquality() {
            Order o1 = new Order(1, "ORD-001", "Khách A", 1, OrderType.DINE_IN);
            Order sameCode = new Order(2, "ORD-001", "Khách C", 3, OrderType.DELIVERY);
            Order sameId = new Order(1, "ORD-002", "Khách B", 2, OrderType.PICKUP);
            Order unsaved = new Order();
            Order otherUnsaved = new Order();

            assertEquals(o1, sameCode, "Equal by OrderCode");
            assertEquals(o1.hashCode(), sameCode.hashCode(), "equal orders share a hash");
            assertNotEquals(o1, sameId, "an id alone does not merge two order codes");
            assertNotEquals(unsaved, otherUnsaved, "two orders without a code are different orders");
            assertEquals(unsaved, unsaved);
            assertTrue(o1.toString().contains("ORD-001"));
        }
    }

    @Nested
    @DisplayName("Reservation Entity Tests")
    class ReservationTest {

        @Test
        void endTimeDefaultsToTwoHours() {
            Instant start = Instant.parse("2026-11-05T11:00:00Z");
            Reservation res = new Reservation(1, "RES-001", "Khach", "0912345678", start, 2);
            assertNull(res.getStoredEndTime());
            assertEquals(start.plus(Reservation.DEFAULT_LENGTH), res.getEndTime());
            res.setEndTime(start.plusSeconds(1800));
            assertEquals(start.plusSeconds(1800), res.getEndTime());
            assertEquals(start.plusSeconds(1800), res.getStoredEndTime());
        }

        @Test
        void overlapsIsHalfOpen() {
            Instant start = Instant.parse("2026-11-05T11:00:00Z");
            Reservation res = new Reservation(1, "RES-001", "Khach", "0912345678", start, 2);
            res.setEndTime(start.plusSeconds(3600));
            assertFalse(res.overlaps(start.plusSeconds(3600), start.plusSeconds(9000)));
            assertTrue(res.overlaps(start.plusSeconds(1800), start.plusSeconds(5400)));
            assertFalse(res.overlaps(start.minusSeconds(3600), start));
        }

        @Test
        @DisplayName("Should initialize defaults and manage pre-orders")
        void testReservationDefaultsAndPreOrders() {
            Instant bookingTime = Instant.now().plusSeconds(7200);
            Reservation res = new Reservation(1, "RES-001", "Trần Thị B", "0912345678", bookingTime, 4);

            assertEquals(1, res.getId());
            assertEquals("RES-001", res.getReservationCode());
            assertEquals("Trần Thị B", res.getCustomer());
            assertEquals("0912345678", res.getContact());
            assertEquals(4, res.getGuests());
            assertEquals(ReservationStatus.PENDING, res.getStatus());
            assertEquals(bookingTime, res.getDateTime());

            res.addPreOrder(new OrderItem("Cà Phê Cold Brew Mận", 2, 50000.0));
            assertEquals(1, res.getPreOrders().size());

            // Danh sách bất biến
            assertThrows(UnsupportedOperationException.class, () ->
                    res.getPreOrders().add(new OrderItem("Extra", 1, 10000.0))
            );

            // Giới hạn dưới của số khách
            res.setGuests(0);
            assertEquals(1, res.getGuests());
        }

        @Test
        @DisplayName("Reservation equality follows the unique code and agrees with hashCode")
        void testReservationEquality() {
            Reservation r1 = new Reservation(1, "RES-001", "A", "01", Instant.now(), 2);
            Reservation sameCode = new Reservation(2, "RES-001", "C", "03", Instant.now(), 2);
            Reservation sameId = new Reservation(1, "RES-002", "B", "02", Instant.now(), 2);

            assertEquals(r1, sameCode);
            assertEquals(r1.hashCode(), sameCode.hashCode());
            assertNotEquals(r1, sameId);
            assertNotEquals(new Reservation(), new Reservation());
            assertTrue(r1.toString().contains("RES-001"));
        }
    }

    @Nested
    @DisplayName("Customer Entity Tests")
    class CustomerTest {

        @Test
        @DisplayName("Should automatically upgrade membership rank based on lifetime spend")
        void testCustomerRankProgression() {
            Customer customer = new Customer(1, "Phạm Hoàng", "0988776655", "phamhoang@dalatcafe.com");

            assertEquals(CustomerRank.BRONZE, customer.getRank());
            assertEquals(0, customer.getTotalOrders());
            assertEquals(0.0, customer.getTotalSpent());
            assertEquals(0, customer.getLoyaltyPoints());

            // Chi 450.000 -> vẫn BRONZE (< 500.000)
            customer.addOrderRecord(450000.0, 45);
            assertEquals(CustomerRank.BRONZE, customer.getRank());
            assertEquals(1, customer.getTotalOrders());
            assertEquals(450000.0, customer.getTotalSpent());
            assertEquals(45, customer.getLoyaltyPoints());

            // Chi thêm 150.000 -> tổng 600.000 -> lên SILVER
            customer.addOrderRecord(150000.0, 15);
            assertEquals(CustomerRank.SILVER, customer.getRank());
            assertEquals(2, customer.getTotalOrders());
            assertEquals(600000.0, customer.getTotalSpent());
            assertEquals(60, customer.getLoyaltyPoints());

            // Chi thêm 1.500.000 -> tổng 2.100.000 -> lên GOLD
            customer.addOrderRecord(1500000.0, 150);
            assertEquals(CustomerRank.GOLD, customer.getRank());

            // Chi thêm 3.000.000 -> tổng 5.100.000 -> lên VIP
            customer.addOrderRecord(3000000.0, 300);
            assertEquals(CustomerRank.VIP, customer.getRank());
        }

        @Test
        @DisplayName("Should redeem loyalty points correctly")
        void testPointsRedemption() {
            Customer customer = new Customer();
            customer.setLoyaltyPoints(100);

            // Đổi điểm thành công
            assertTrue(customer.redeemPoints(40));
            assertEquals(60, customer.getLoyaltyPoints());

            // Không đủ điểm
            assertFalse(customer.redeemPoints(70));
            assertEquals(60, customer.getLoyaltyPoints());

            // Số điểm không dương là không hợp lệ
            assertFalse(customer.redeemPoints(0));
            assertFalse(customer.redeemPoints(-10));
            assertEquals(60, customer.getLoyaltyPoints());
        }

        @Test
        @DisplayName("Customer equality follows the unique phone and agrees with hashCode")
        void testCustomerEquality() {
            Customer c1 = new Customer(1, "User A", "0900000001", "a@test.com");
            Customer samePhone = new Customer(2, "User C", "0900000001", "c@test.com");
            Customer sameId = new Customer(1, "User B", "0900000002", "b@test.com");

            assertEquals(c1, samePhone, "Equal by Phone");
            assertEquals(c1.hashCode(), samePhone.hashCode());
            assertNotEquals(c1, sameId);
            assertNotEquals(new Customer(), new Customer());
            assertTrue(c1.toString().contains("User A"));
        }
    }

    @Nested
    @DisplayName("Voucher")
    class VoucherTest {
        private Voucher voucher(java.time.LocalDate start, java.time.LocalDate end) {
            Voucher v = new Voucher();
            v.setCode("SALE1111");
            v.setType(VoucherType.PERCENT);
            v.setValue(10);
            v.setStartDate(start);
            v.setEndDate(end);
            v.setActive(true);
            return v;
        }

        @Test
        void expiresAtVietnamMidnight() {
            Voucher v = voucher(java.time.LocalDate.of(2026, 11, 1), java.time.LocalDate.of(2026, 11, 11));
            assertTrue(v.isWithinDates(Instant.parse("2026-11-11T16:59:59Z")));
            assertFalse(v.isWithinDates(Instant.parse("2026-11-11T17:00:00Z")));
            assertFalse(v.isWithinDates(Instant.parse("2026-10-31T16:59:59Z")));
            assertTrue(v.isWithinDates(Instant.parse("2026-10-31T17:00:00Z")));
        }

        @Test
        void stateAtPriority() {
            Instant now = Instant.parse("2026-11-20T03:00:00Z");
            Voucher expiredAndDisabled = voucher(java.time.LocalDate.of(2026, 11, 1), java.time.LocalDate.of(2026, 11, 11));
            expiredAndDisabled.setActive(false);
            assertEquals(Voucher.VoucherState.DISABLED, expiredAndDisabled.stateAt(now));

            Voucher expiredAndSoldOut = voucher(java.time.LocalDate.of(2026, 11, 1), java.time.LocalDate.of(2026, 11, 11));
            expiredAndSoldOut.setMaxUses(1);
            expiredAndSoldOut.setUsedCount(1);
            assertEquals(Voucher.VoucherState.EXPIRED, expiredAndSoldOut.stateAt(now));

            Voucher soldOut = voucher(java.time.LocalDate.of(2026, 11, 1), java.time.LocalDate.of(2026, 12, 1));
            soldOut.setMaxUses(1);
            soldOut.setUsedCount(1);
            assertEquals(Voucher.VoucherState.SOLD_OUT, soldOut.stateAt(now));

            Voucher upcoming = voucher(java.time.LocalDate.of(2026, 12, 1), java.time.LocalDate.of(2026, 12, 31));
            assertEquals(Voucher.VoucherState.UPCOMING, upcoming.stateAt(now));

            Voucher running = voucher(java.time.LocalDate.of(2026, 11, 1), java.time.LocalDate.of(2026, 12, 1));
            assertEquals(Voucher.VoucherState.RUNNING, running.stateAt(now));
        }
    }
}

