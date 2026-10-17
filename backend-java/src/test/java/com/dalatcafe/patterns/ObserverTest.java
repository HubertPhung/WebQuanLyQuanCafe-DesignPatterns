package com.dalatcafe.patterns;

import com.dalatcafe.dao.ICustomerDao;
import com.dalatcafe.dao.ITableDao;
import com.dalatcafe.dao.InMemoryCustomerDao;
import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.dao.InMemoryTableDao;
import com.dalatcafe.model.Customer;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.model.Table;
import com.dalatcafe.model.TableStatus;
import com.dalatcafe.patterns.builder.OrderBuilder;
import com.dalatcafe.patterns.decorator.BaseCoffee;
import com.dalatcafe.patterns.observer.IOrderObserver;
import com.dalatcafe.patterns.observer.KitchenNotificationObserver;
import com.dalatcafe.patterns.observer.LoyaltyPointObserver;
import com.dalatcafe.patterns.observer.OrderEventSubject;
import com.dalatcafe.patterns.observer.TableStatusSyncObserver;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ObserverTest {
    private ICustomerDao customerDao;
    private ITableDao tableDao;
    private Customer customer;
    private Table table;

    @BeforeEach
    void setUp() {
        InMemoryDatabase database = InMemoryDatabase.getInstance();
        database.reset();
        customerDao = new InMemoryCustomerDao(database);
        tableDao = new InMemoryTableDao(database);

        customer = new Customer(null, "Nguyen Hung Thinh", "0909000006", "thinh@dalatcafe.com");
        customerDao.save(customer);

        table = new Table(99, "Table 99", 4, "Main");
        table.setStatus(TableStatus.OCCUPIED);
        table.setGuestCount(2);
        tableDao.save(table);
    }

    @Test
    void paidEventEarnsPointsSeatsTableAndOpensKdsTicket() {
        Order order = paidOrder();
        List<String> notifications = new ArrayList<>();
        OrderEventSubject subject = allObservers(notifications);
        tableDao.updateStatus(table.getId(), TableStatus.AVAILABLE, 0);

        subject.notifyOrderPaid(order);

        Customer updatedCustomer = customerDao.findById(customer.getId()).orElseThrow();
        int expectedPoints = SystemConfigManager.getInstance().calculateLoyaltyPoints(order.getTotal());
        assertEquals(expectedPoints, updatedCustomer.getLoyaltyPoints());
        assertEquals(1, updatedCustomer.getTotalOrders());
        assertEquals(order.getTotal(), updatedCustomer.getTotalSpent());

        Table updatedTable = tableDao.findById(table.getId()).orElseThrow();
        assertEquals(TableStatus.OCCUPIED, updatedTable.getStatus());
        assertEquals(1, updatedTable.getGuestCount());
        assertTrue(notifications.get(0).contains(order.getOrderCode()));
        assertTrue(notifications.get(0).contains("paid"));
    }

    @Test
    void paidEventKeepsGuestCountOfSeatedTable() {
        OrderEventSubject subject = new OrderEventSubject();
        subject.attach(new TableStatusSyncObserver(tableDao));

        subject.notifyOrderPaid(paidOrder());

        assertEquals(2, tableDao.findById(table.getId()).orElseThrow().getGuestCount());
    }

    @Test
    void completedEventFreesTableForCleaningWithoutEarningPointsTwice() {
        Order order = paidOrder();
        List<String> notifications = new ArrayList<>();
        OrderEventSubject subject = allObservers(notifications);

        subject.notifyOrderCompleted(order);

        Customer unchanged = customerDao.findById(customer.getId()).orElseThrow();
        assertEquals(0, unchanged.getLoyaltyPoints());
        Table updatedTable = tableDao.findById(table.getId()).orElseThrow();
        assertEquals(TableStatus.CLEANING, updatedTable.getStatus());
        assertEquals(0, updatedTable.getGuestCount());
        assertTrue(notifications.get(0).contains("remove it from KDS"));
    }

    @Test
    void preventsDuplicateObserversAndSupportsDetach() {
        AtomicInteger notifications = new AtomicInteger();
        IOrderObserver observer = IOrderObserver.whenCompleted(order -> notifications.incrementAndGet());
        OrderEventSubject subject = new OrderEventSubject();
        subject.attach(observer);
        subject.attach(observer);

        subject.notifyOrderCompleted(paidOrder());
        subject.notifyOrderPaid(paidOrder());
        subject.detach(observer);
        subject.notifyOrderCompleted(paidOrder());

        assertEquals(1, notifications.get());
    }

    @Test
    void unpaidOrderDoesNotEarnLoyaltyPoints() {
        OrderEventSubject subject = new OrderEventSubject();
        subject.attach(new LoyaltyPointObserver(customerDao, customer.getId()));

        subject.notifyOrderPaid(order(true, false));

        Customer unchanged = customerDao.findById(customer.getId()).orElseThrow();
        assertEquals(0, unchanged.getLoyaltyPoints());
        assertEquals(0, unchanged.getTotalOrders());
    }

    @Test
    void takeawayOrderWithoutTableLeavesFloorPlanUntouched() {
        OrderEventSubject subject = new OrderEventSubject();
        subject.attach(new TableStatusSyncObserver(tableDao));

        subject.notifyOrderPaid(order(false, true));
        subject.notifyOrderCompleted(order(false, true));

        Table unchanged = tableDao.findById(table.getId()).orElseThrow();
        assertEquals(TableStatus.OCCUPIED, unchanged.getStatus());
        assertEquals(2, unchanged.getGuestCount());
    }

    @Test
    void unknownCustomerFailsLoudly() {
        OrderEventSubject subject = new OrderEventSubject();
        subject.attach(new LoyaltyPointObserver(customerDao, 9_999));

        assertThrows(IllegalStateException.class, () -> subject.notifyOrderPaid(paidOrder()));
    }

    @Test
    void unknownTableFailsLoudly() {
        Order order = paidOrder();
        order.setTableId(9_999);
        OrderEventSubject subject = new OrderEventSubject();
        subject.attach(new TableStatusSyncObserver(tableDao));

        assertThrows(IllegalStateException.class, () -> subject.notifyOrderPaid(order));
        assertThrows(IllegalStateException.class, () -> subject.notifyOrderCompleted(order));
    }

    @Test
    void rejectsInvalidArguments() {
        OrderEventSubject subject = new OrderEventSubject();

        assertThrows(NullPointerException.class, () -> subject.attach(null));
        assertThrows(NullPointerException.class, () -> subject.notifyOrderCompleted(null));
        assertThrows(NullPointerException.class, () -> subject.notifyOrderPaid(null));
        assertThrows(IllegalArgumentException.class, () -> new LoyaltyPointObserver(customerDao, 0));
        assertThrows(NullPointerException.class, () -> new TableStatusSyncObserver(null));
    }

    @Test
    void subjectWithoutObserversIsNoOp() {
        assertDoesNotThrow(() -> new OrderEventSubject().notifyOrderCompleted(paidOrder()));
    }

    private OrderEventSubject allObservers(List<String> kitchen) {
        OrderEventSubject subject = new OrderEventSubject();
        subject.attach(new LoyaltyPointObserver(customerDao, customer.getId()));
        subject.attach(new TableStatusSyncObserver(tableDao));
        subject.attach(new KitchenNotificationObserver(kitchen::add));
        return subject;
    }

    private Order paidOrder() {
        return order(true, true);
    }

    private Order order(boolean dineIn, boolean paid) {
        MenuItem menuItem = new MenuItem(1, "Latte", "Coffee", 50_000, 18_000, 100);
        OrderBuilder builder = new OrderBuilder()
                .forCustomer(customer.getName())
                .addItem(new BaseCoffee(menuItem), 1)
                .withPayment(PaymentMethod.CASH, paid);
        if (dineIn) {
            builder.atTable(table.getId());
        }
        Order order = builder.build();
        order.setStatus(OrderStatus.COMPLETED);
        return order;
    }
}
