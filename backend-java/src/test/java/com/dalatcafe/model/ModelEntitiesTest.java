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

            // Minimum quantity clamping
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

            // Transition to OCCUPIED
            table.setStatus(TableStatus.OCCUPIED);
            table.setGuestCount(3);
            assertEquals(TableStatus.OCCUPIED, table.getStatus());
            assertNotNull(table.getOccupiedSince());
            assertEquals(3, table.getGuestCount());

            // Transition to AVAILABLE (clears occupiedSince and guestCount)
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
        @DisplayName("Should detect low stock correctly based on threshold")
        void testLowStockDetection() {
            MenuItem item = new MenuItem(1, "Hạt Cà Phê Cầu Đất Arabica", "Cà Phê", 85000.0, 45000.0, 15.0);

            assertFalse(item.isLowStock(), "15 units should not be low stock when threshold is 10");

            item.setStockQty(10.0);
            assertTrue(item.isLowStock(), "10 units equals threshold, should be low stock");

            item.setStockQty(5.0);
            assertTrue(item.isLowStock(), "5 units is below threshold, should be low stock");

            item.setLowStockThreshold(4.0);
            assertFalse(item.isLowStock(), "5 units should not be low stock when threshold is lowered to 4");
        }

        @Test
        @DisplayName("Should manage variations safely with defensive copying")
        void testMenuItemVariations() {
            MenuItem item = new MenuItem(2, "Latte Đà Lạt Sương Mù", "Cà Phê", 55000.0, 25000.0, 50.0);

            item.addVariation(new Variation("Nóng", 0.0));
            item.addVariation(new Variation("Đá", 0.0));
            item.addVariation(new Variation("Size L", 10000.0));

            assertEquals(3, item.getVariations().size());

            // Returned list should be unmodifiable
            assertThrows(UnsupportedOperationException.class, () ->
                    item.getVariations().add(new Variation("Extra shot", 15000.0))
            );

            // Defensive copy on setVariations
            List<Variation> externalList = List.of(new Variation("Mặc định", 0.0));
            item.setVariations(externalList);
            assertEquals(1, item.getVariations().size());
            assertEquals("Mặc định", item.getVariations().get(0).getName());
        }

        @Test
        @DisplayName("MenuItem getters, setters, and equality")
        void testMenuItemProperties() {
            MenuItem item1 = new MenuItem(10, "Bạc Xỉu", "Cà Phê", 39000.0, 15000.0, 100.0);
            MenuItem item2 = new MenuItem(10, "Bạc Xỉu Đà Lạt", "Cà Phê", 42000.0, 15000.0, 80.0);
            MenuItem item3 = new MenuItem(11, "Americano", "Cà Phê", 35000.0, 12000.0, 50.0);

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

            // Subtotal = 125,000
            assertEquals(125000.0, order.getSubtotal(), 0.01);
            // Default VAT 8% on 125,000 = 10,000
            assertEquals(10000.0, order.getVatAmount(), 0.01);
            // Total = 125,000 + 10,000 = 135,000
            assertEquals(135000.0, order.getTotal(), 0.01);

            // Apply 25,000 discount
            order.setDiscountAmount(25000.0);
            // After discount: 100,000
            // VAT 8% on 100,000 = 8,000
            // Total = 100,000 + 8,000 = 108,000
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
        @DisplayName("Order equality by id or orderCode")
        void testOrderEquality() {
            Order o1 = new Order(1, "ORD-001", "Khách A", 1, OrderType.DINE_IN);
            Order o2 = new Order(1, "ORD-002", "Khách B", 2, OrderType.PICKUP);
            Order o3 = new Order(2, "ORD-001", "Khách C", 3, OrderType.DELIVERY);
            Order o4 = new Order(3, "ORD-999", "Khách D", 4, OrderType.DINE_IN);

            assertEquals(o1, o2, "Equal by ID");
            assertEquals(o1, o3, "Equal by OrderCode");
            assertNotEquals(o1, o4);
            assertTrue(o1.toString().contains("ORD-001"));
        }
    }

    @Nested
    @DisplayName("Reservation Entity Tests")
    class ReservationTest {

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

            // Immutable list
            assertThrows(UnsupportedOperationException.class, () ->
                    res.getPreOrders().add(new OrderItem("Extra", 1, 10000.0))
            );

            // Guests min bound
            res.setGuests(0);
            assertEquals(1, res.getGuests());
        }

        @Test
        @DisplayName("Reservation equality based on ID or code")
        void testReservationEquality() {
            Reservation r1 = new Reservation(1, "RES-001", "A", "01", Instant.now(), 2);
            Reservation r2 = new Reservation(1, "RES-002", "B", "02", Instant.now(), 2);
            Reservation r3 = new Reservation(2, "RES-001", "C", "03", Instant.now(), 2);
            Reservation r4 = new Reservation(3, "RES-999", "D", "04", Instant.now(), 2);

            assertEquals(r1, r2);
            assertEquals(r1, r3);
            assertNotEquals(r1, r4);
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

            // Spend 450,000 -> Still BRONZE (< 500,000)
            customer.addOrderRecord(450000.0, 45);
            assertEquals(CustomerRank.BRONZE, customer.getRank());
            assertEquals(1, customer.getTotalOrders());
            assertEquals(450000.0, customer.getTotalSpent());
            assertEquals(45, customer.getLoyaltyPoints());

            // Spend +150,000 -> Total 600,000 -> Upgrade to SILVER
            customer.addOrderRecord(150000.0, 15);
            assertEquals(CustomerRank.SILVER, customer.getRank());
            assertEquals(2, customer.getTotalOrders());
            assertEquals(600000.0, customer.getTotalSpent());
            assertEquals(60, customer.getLoyaltyPoints());

            // Spend +1,500,000 -> Total 2,100,000 -> Upgrade to GOLD
            customer.addOrderRecord(1500000.0, 150);
            assertEquals(CustomerRank.GOLD, customer.getRank());

            // Spend +3,000,000 -> Total 5,100,000 -> Upgrade to VIP
            customer.addOrderRecord(3000000.0, 300);
            assertEquals(CustomerRank.VIP, customer.getRank());
        }

        @Test
        @DisplayName("Should redeem loyalty points correctly")
        void testPointsRedemption() {
            Customer customer = new Customer();
            customer.setLoyaltyPoints(100);

            // Successful redemption
            assertTrue(customer.redeemPoints(40));
            assertEquals(60, customer.getLoyaltyPoints());

            // Insufficient points
            assertFalse(customer.redeemPoints(70));
            assertEquals(60, customer.getLoyaltyPoints());

            // Invalid non-positive points
            assertFalse(customer.redeemPoints(0));
            assertFalse(customer.redeemPoints(-10));
            assertEquals(60, customer.getLoyaltyPoints());
        }

        @Test
        @DisplayName("Customer equality by id or phone")
        void testCustomerEquality() {
            Customer c1 = new Customer(1, "User A", "0900000001", "a@test.com");
            Customer c2 = new Customer(1, "User B", "0900000002", "b@test.com");
            Customer c3 = new Customer(2, "User C", "0900000001", "c@test.com");
            Customer c4 = new Customer(3, "User D", "0900000003", "d@test.com");

            assertEquals(c1, c2, "Equal by ID");
            assertEquals(c1, c3, "Equal by Phone");
            assertNotEquals(c1, c4);
            assertTrue(c1.toString().contains("User A"));
        }
    }
}

