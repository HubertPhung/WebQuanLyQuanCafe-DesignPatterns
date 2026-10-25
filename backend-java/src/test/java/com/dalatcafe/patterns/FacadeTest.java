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
        MenuItem drink = new MenuItem(DRINK_ID, "Ca phe sua", "Coffee", 50_000, 20_000);
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
        // Đơn đã thanh toán chờ trên KDS; quầy pha chế hoàn tất chúng sau.
        assertEquals(OrderStatus.PENDING, order.getStatus());
        assertTrue(completed.isEmpty());
        assertEquals(PaymentStatus.PAID, order.getPaymentStatus());
        assertEquals(3, order.getTableId());
        assertEquals(DRINK_ID, order.getItems().get(0).getMenuItemId(), "line keeps its menu item");
        assertNotNull(order.getId());
        assertTrue(orderDao.findById(order.getId()).isPresent());
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
    }

    @Test
    void anyQuantityIsSoldWhileTheItemIsOnSale() {
        // Không theo dõi số lượng, nên chỉ công tắc in-stock mới từ chối được một dòng.
        CheckoutResult result = facade.checkout(request(50, PaymentMethod.CASH, Set.of(), false));
        assertTrue(result.isSuccess(), result.getMessage());
        assertEquals(50, result.getOrder().getItems().get(0).getQty());
    }

    @Test
    void rejectsUnknownAndOutOfStockItems() {
        CheckoutRequest unknown = new CheckoutRequest(List.of(new CheckoutLine(123_456, 1)), null,
                OrderType.DINE_IN, PaymentMethod.CASH, null, null, null);
        assertFalse(facade.checkout(unknown).isSuccess());

        menuDao.toggleInStock(DRINK_ID, false);
        CheckoutResult offSale = facade.checkout(request(1, PaymentMethod.CASH, Set.of(), false));
        assertFalse(offSale.isSuccess());
        assertEquals(CheckoutResult.FailureType.OUT_OF_STOCK, offSale.getFailureType());
        assertNull(offSale.getPaymentResult(), "no payment is taken");
        assertTrue(orderDao.findAll().stream().noneMatch(o -> o.getTableId() != null && o.getTableId() == 3));
    }

    @Test
    void reportsFailureWhenOrderCannotBeSaved() {
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
    }

    @Test
    void takenOrderCodeIsReplacedBeforePaymentIsTaken() {
        List<String> looked = new ArrayList<>();
        Order existing = new Order(null, "AC-TAKEN-1", "Walk-in", null, OrderType.PICKUP);
        IOrderDao codesDao = new InMemoryOrderDao(InMemoryDatabase.getInstance()) {
            @Override
            public java.util.Optional<Order> findByOrderCode(String code) {
                looked.add(code);
                // Mã ngẫu nhiên đầu tiên đã thuộc về một đơn cũ hơn.
                return looked.size() == 1 ? java.util.Optional.of(existing) : super.findByOrderCode(code);
            }
        };
        PosCheckoutFacade unique = new PosCheckoutFacade(codesDao, menuDao, subject);

        CheckoutResult result = unique.checkout(request(1, PaymentMethod.CASH, Set.of(), false));

        assertTrue(result.isSuccess(), result.getMessage());
        assertTrue(looked.size() >= 2, "the code is checked and drawn again: " + looked);
        assertNotEquals(looked.get(0), result.getOrder().getOrderCode());
        assertEquals(looked.get(looked.size() - 1), result.getOrder().getOrderCode());
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
    }

    @Test
    void validatesRequestShape() {
        assertThrows(IllegalArgumentException.class,
                () -> new CheckoutRequest(List.of(), null, null, PaymentMethod.CASH, null, null, null));
        assertThrows(NullPointerException.class, () -> facade.checkout(null));
        assertThrows(IllegalArgumentException.class, () -> new CheckoutLine(DRINK_ID, 0));
    }
}
