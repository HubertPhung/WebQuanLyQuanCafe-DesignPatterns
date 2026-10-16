package com.dalatcafe.patterns;

import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderItem;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.Reservation;
import com.dalatcafe.patterns.adapter.IPosOrderTarget;
import com.dalatcafe.patterns.adapter.ReservationToOrderAdapter;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class AdapterTest {
    private Reservation reservation() {
        Reservation r = new Reservation(1, "RES-001", "Nguyen Van A", "0901234567", Instant.now(), 4);
        r.setTableId(7);
        r.setNote("Sinh nhat");
        r.addPreOrder(new OrderItem("Cafe sua", 2, 35_000));
        r.addPreOrder(new OrderItem("Tra dao", 1, 45_000, "L"));
        return r;
    }

    @Test
    void mapsReservationToPendingOrderWithoutLosingDetails() {
        Reservation r = reservation();
        IPosOrderTarget target = new ReservationToOrderAdapter(r);
        Order order = target.toPosOrder();

        assertEquals("RES-001", order.getOrderCode());
        assertEquals("Nguyen Van A", order.getCustomer());
        assertEquals(7, order.getTableId());
        assertEquals(OrderStatus.PENDING, order.getStatus());
        assertEquals("Sinh nhat", order.getNote());
        assertEquals(2, order.getItems().size());
        assertEquals(2, order.getItems().get(0).getQty());
        assertEquals("L", order.getItems().get(1).getVariation());
        assertEquals(115_000, order.getSubtotal());
        assertEquals(7, target.getAssignedTableId());
        assertEquals("Nguyen Van A", target.getCustomerIdentifier());
    }

    @Test
    void doesNotAlterReservationOrShareItems() {
        Reservation r = reservation();
        Order order = new ReservationToOrderAdapter(r).toPosOrder();
        order.getItems().get(0).setQty(99);
        assertEquals(2, r.getPreOrders().get(0).getQty());
        assertEquals(2, r.getPreOrders().size());
    }

    @Test
    void handlesMissingOptionalData() {
        Reservation r = new Reservation(2, "RES-002", " ", "0909999999", Instant.now(), 2);
        r.setPreOrders(null);
        IPosOrderTarget target = new ReservationToOrderAdapter(r);
        assertEquals("0909999999", target.getCustomerIdentifier());
        assertEquals(-1, target.getAssignedTableId());
        assertTrue(target.toPosOrder().getItems().isEmpty());
    }

    @Test
    void rejectsNullReservation() {
        assertThrows(NullPointerException.class, () -> new ReservationToOrderAdapter(null));
    }
}
