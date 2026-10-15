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

import static org.junit.jupiter.api.Assertions.assertEquals;
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
    void notifiesLoyaltyTableAndKitchenObservers() {
        Order order = paidOrder();
        List<String> notifications = new ArrayList<>();
        OrderEventSubject subject = new OrderEventSubject();
        subject.attach(new LoyaltyPointObserver(customerDao, customer.getId()));
        subject.attach(new TableStatusSyncObserver(tableDao));
        subject.attach(new KitchenNotificationObserver(notifications::add));

        subject.notifyOrderCompleted(order);

        Customer updatedCustomer = customerDao.findById(customer.getId()).orElseThrow();
        int expectedPoints = SystemConfigManager.getInstance().calculateLoyaltyPoints(order.getTotal());
        assertEquals(expectedPoints, updatedCustomer.getLoyaltyPoints());
        assertEquals(1, updatedCustomer.getTotalOrders());
        assertEquals(order.getTotal(), updatedCustomer.getTotalSpent());

        Table updatedTable = tableDao.findById(table.getId()).orElseThrow();
        assertEquals(TableStatus.CLEANING, updatedTable.getStatus());
        assertEquals(0, updatedTable.getGuestCount());
        assertTrue(notifications.get(0).contains(order.getOrderCode()));
    }

    @Test
    void preventsDuplicateObserversAndSupportsDetach() {
        AtomicInteger notifications = new AtomicInteger();
        IOrderObserver observer = order -> notifications.incrementAndGet();
        OrderEventSubject subject = new OrderEventSubject();
        subject.attach(observer);
        subject.attach(observer);

        subject.notifyOrderCompleted(paidOrder());
        subject.detach(observer);
        subject.notifyOrderCompleted(paidOrder());

        assertEquals(1, notifications.get());
    }

    private Order paidOrder() {
        MenuItem menuItem = new MenuItem(1, "Latte", "Coffee", 50_000, 18_000, 100);
        Order order = new OrderBuilder()
                .forCustomer(customer.getName())
                .atTable(table.getId())
                .addItem(new BaseCoffee(menuItem), 1)
                .withPayment(PaymentMethod.CASH, true)
                .build();
        order.setStatus(OrderStatus.COMPLETED);
        return order;
    }
}
