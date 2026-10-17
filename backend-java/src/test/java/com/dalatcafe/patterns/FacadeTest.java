package com.dalatcafe.patterns;

import com.dalatcafe.dao.IMenuDao;
import com.dalatcafe.dao.IOrderDao;
import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.dao.InMemoryMenuDao;
import com.dalatcafe.dao.InMemoryOrderDao;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.OrderType;
import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.patterns.facade.CheckoutLine;
import com.dalatcafe.patterns.facade.CheckoutRequest;
import com.dalatcafe.patterns.facade.CheckoutResult;
import com.dalatcafe.patterns.facade.Customization;
import com.dalatcafe.patterns.facade.PosCheckoutFacade;
import com.dalatcafe.patterns.observer.IOrderObserver;
import com.dalatcafe.patterns.observer.OrderEventSubject;
import com.dalatcafe.patterns.strategy.FixedAmountDiscountStrategy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class FacadeTest {
    private static final int DRINK_ID = 900;

    private IMenuDao menuDao;
    private IOrderDao orderDao;
    private OrderEventSubject subject;
    private PosCheckoutFacade facade;

    @BeforeEach
    void setUp() {
        InMemoryDatabase database = InMemoryDatabase.getInstance();
        database.reset();
        menuDao = new InMemoryMenuDao(database);
        orderDao = new InMemoryOrderDao(database);
        MenuItem drink = new MenuItem(DRINK_ID, "Ca phe sua", "Coffee", 50_000, 20_000, 10);
        drink.setInStock(true);
        menuDao.save(drink);
        subject = new OrderEventSubject();
        facade = new PosCheckoutFacade(orderDao, menuDao, subject);
    }

    private CheckoutRequest request(int qty, PaymentMethod method, Set<Customization> extras,
                                    boolean discount) {
        return new CheckoutRequest(List.of(new CheckoutLine(DRINK_ID, qty, extras)), 3,
                OrderType.DINE_IN, method, null,
                discount ? new FixedAmountDiscountStrategy(30_000) : null, "no ice");
    }

    private double stock() {
        return menuDao.findById(DRINK_ID).orElseThrow().getStockQty();
    }

    @Test
    void checkoutRunsFullWorkflowWithOneCall() {
        List<Order> notified = new ArrayList<>();
        List<Order> completed = new ArrayList<>();
        subject.attach(IOrderObserver.whenPaid(notified::add));
        subject.attach(IOrderObserver.whenCompleted(completed::add));

        CheckoutResult result = facade.checkout(request(2, PaymentMethod.CASH, Set.of(), true));

        assertTrue(result.isSuccess());
        Order order = result.getOrder();
        assertEquals(100_000, order.getSubtotal());
        assertEquals(30_000, order.getDiscountAmount());
        assertEquals(75_600, order.getTotal());
        // Paid orders wait on the KDS; the kitchen completes them later.
        assertEquals(OrderStatus.PENDING, order.getStatus());
        assertTrue(completed.isEmpty());
        assertEquals(PaymentStatus.PAID, order.getPaymentStatus());
        assertEquals(3, order.getTableId());
        assertNotNull(order.getId());
        assertTrue(orderDao.findById(order.getId()).isPresent());
        assertEquals(8, stock());
        assertEquals(List.of(order), notified);
        assertTrue(result.getPaymentResult().isSuccess());
        assertTrue(result.getWarnings().isEmpty());
    }

    @Test
    void appliesStackedCustomizationsToPrice() {
        CheckoutResult result = facade.checkout(
                request(1, PaymentMethod.CASH, Set.of(Customization.SIZE_L, Customization.CHEESE_FOAM), false));
        assertTrue(result.isSuccess());
        assertTrue(result.getOrder().getSubtotal() > 50_000);
        assertTrue(result.getOrder().getItems().get(0).getName().contains("Size L"));
    }

    @Test
    void discountNeverMakesTotalNegative() {
        CheckoutRequest cheap = new CheckoutRequest(List.of(new CheckoutLine(DRINK_ID, 1)), null,
                OrderType.PICKUP, PaymentMethod.CASH, null, new FixedAmountDiscountStrategy(999_999), null);
        CheckoutResult result = facade.checkout(cheap);
        assertTrue(result.isSuccess());
        assertEquals(0, result.getOrder().getTotal());
        assertEquals(50_000, result.getOrder().getDiscountAmount());
        assertEquals(9, stock());
    }

    @Test
    void rejectsInsufficientStockWithoutSideEffects() {
        CheckoutResult result = facade.checkout(request(11, PaymentMethod.CASH, Set.of(), false));
        assertFalse(result.isSuccess());
        assertNull(result.getOrder());
        assertEquals(10, stock());
        assertTrue(orderDao.findAll().stream().noneMatch(o -> o.getTableId() != null && o.getTableId() == 3));
    }

    @Test
    void rejectsUnknownAndOutOfStockItems() {
        CheckoutRequest unknown = new CheckoutRequest(List.of(new CheckoutLine(123_456, 1)), null,
                OrderType.DINE_IN, PaymentMethod.CASH, null, null, null);
        assertFalse(facade.checkout(unknown).isSuccess());

        menuDao.toggleInStock(DRINK_ID, false);
        assertFalse(facade.checkout(request(1, PaymentMethod.CASH, Set.of(), false)).isSuccess());
        assertEquals(10, stock());
    }

    @Test
    void restoresStockWhenOrderCannotBeSaved() {
        IOrderDao failingDao = new InMemoryOrderDao(InMemoryDatabase.getInstance()) {
            @Override
            public boolean save(Order order) {
                return false;
            }
        };
        PosCheckoutFacade failing = new PosCheckoutFacade(failingDao, menuDao, subject);
        CheckoutResult result = failing.checkout(request(2, PaymentMethod.CASH, Set.of(), false));
        assertFalse(result.isSuccess());
        assertNull(result.getOrder());
        assertNotNull(result.getPaymentResult());
        assertEquals(10, stock());
    }

    @Test
    void observerFailureDoesNotUndoCommittedCheckout() {
        subject.attach(IOrderObserver.whenPaid(order -> {
            throw new IllegalStateException("boom");
        }));
        CheckoutResult result = facade.checkout(request(1, PaymentMethod.CASH, Set.of(), false));
        assertTrue(result.isSuccess());
        assertEquals(1, result.getWarnings().size());
        assertTrue(orderDao.findById(result.getOrder().getId()).isPresent());
        assertEquals(9, stock());
    }

    @Test
    void validatesRequestShape() {
        assertThrows(IllegalArgumentException.class,
                () -> new CheckoutRequest(List.of(), null, null, PaymentMethod.CASH, null, null, null));
        assertThrows(NullPointerException.class, () -> facade.checkout(null));
        assertThrows(IllegalArgumentException.class, () -> new CheckoutLine(DRINK_ID, 0));
    }
}
