package com.dalatcafe.patterns.facade;

import com.dalatcafe.dao.DaoFactory;
import com.dalatcafe.dao.IMenuDao;
import com.dalatcafe.dao.IOrderDao;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.patterns.builder.OrderBuilder;
import com.dalatcafe.patterns.decorator.BaseCoffee;
import com.dalatcafe.patterns.decorator.CheeseFoamDecorator;
import com.dalatcafe.patterns.decorator.IBeverage;
import com.dalatcafe.patterns.decorator.LargeSizeDecorator;
import com.dalatcafe.patterns.decorator.PearlToppingDecorator;
import com.dalatcafe.patterns.factory.IPaymentProcessor;
import com.dalatcafe.patterns.factory.PaymentProcessorFactory;
import com.dalatcafe.patterns.factory.PaymentResult;
import com.dalatcafe.patterns.observer.OrderEventSubject;
import com.dalatcafe.patterns.strategy.DiscountContext;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Facade Pattern (GoF Structural): single entry point {@link #checkout(CheckoutRequest)} that
 * orchestrates OrderBuilder, BeverageDecorator, DiscountStrategy, PaymentProcessorFactory,
 * OrderEventSubject and the DAO layer.
 *
 * Consistency: stock is validated, then reserved, then payment is taken, then the order is
 * saved. Any failure before the order is saved restores the reserved stock and persists nothing.
 * Observers run after the commit; their failures are reported as warnings and never undo it.
 */
public class PosCheckoutFacade {
    private static final Logger LOGGER = Logger.getLogger(PosCheckoutFacade.class.getName());

    private final IOrderDao orderDao;
    private final IMenuDao menuDao;
    private final OrderEventSubject eventSubject;

    public PosCheckoutFacade() {
        this(DaoFactory.getInstance().getOrderDao(), DaoFactory.getInstance().getMenuDao(),
                new OrderEventSubject());
    }

    public PosCheckoutFacade(IOrderDao orderDao, IMenuDao menuDao, OrderEventSubject eventSubject) {
        this.orderDao = Objects.requireNonNull(orderDao, "Order DAO must not be null");
        this.menuDao = Objects.requireNonNull(menuDao, "Menu DAO must not be null");
        this.eventSubject = Objects.requireNonNull(eventSubject, "Event subject must not be null");
    }

    public OrderEventSubject getEventSubject() {
        return eventSubject;
    }

    /**
     * Executes the whole checkout. Does not throw for business failures; inspect the result.
     */
    public synchronized CheckoutResult checkout(CheckoutRequest request) {
        Objects.requireNonNull(request, "Request must not be null");

        Map<Integer, MenuItem> menu = new LinkedHashMap<>();
        Map<Integer, Integer> demand = new LinkedHashMap<>();
        CheckoutResult problem = resolveMenu(request, menu, demand);
        if (problem != null) {
            return problem;
        }

        // Steps 1-3: decorate drinks, build the order, apply the discount.
        Order order = buildOrder(request, menu);
        if (!reserveStock(demand)) {
            return CheckoutResult.failure(CheckoutResult.FailureType.OUT_OF_STOCK, "Could not reserve inventory", null);
        }

        // Step 4: payment.
        PaymentResult payment;
        try {
            if (order.getTotal() <= 0) {
                // Fully discounted order: processors reject zero amounts, so nothing is charged.
                payment = new PaymentResult(true, "NO-CHARGE-" + order.getOrderCode(), "Nothing to charge");
            } else {
                IPaymentProcessor processor = PaymentProcessorFactory.createProcessor(request.getPaymentMethod());
                payment = processor.processPayment(order.getTotal(), order.getOrderCode());
            }
        } catch (RuntimeException e) {
            releaseStock(demand);
            return CheckoutResult.failure(CheckoutResult.FailureType.PAYMENT_FAILED, "Payment error: " + e.getMessage(), null);
        }
        if (payment == null || !payment.isSuccess()) {
            releaseStock(demand);
            return CheckoutResult.failure(CheckoutResult.FailureType.PAYMENT_FAILED,
                    payment == null ? "Payment declined" : "Payment declined: " + payment.getMessage(), payment);
        }

        // Step 5: persist the completed order.
        order.setPaymentStatus(PaymentStatus.PAID);
        order.setStatus(OrderStatus.COMPLETED);
        boolean saved;
        try {
            saved = orderDao.save(order);
        } catch (RuntimeException e) {
            LOGGER.log(Level.SEVERE, "Order save failed after payment " + payment.getTransactionId(), e);
            saved = false;
        }
        if (!saved) {
            releaseStock(demand);
            return CheckoutResult.failure(CheckoutResult.FailureType.PERSISTENCE_FAILED, "Order could not be saved (payment "
                    + payment.getTransactionId() + " must be voided)", payment);
        }

        // Step 6: broadcast; observer failures must not undo a committed checkout.
        List<String> warnings = new ArrayList<>();
        try {
            eventSubject.notifyOrderCompleted(order);
        } catch (RuntimeException e) {
            LOGGER.log(Level.WARNING, "Order event observer failed: " + e.getMessage(), e);
            warnings.add("Order event observer failed: " + e.getMessage());
        }
        return CheckoutResult.success(order, payment, warnings);
    }

    private CheckoutResult resolveMenu(CheckoutRequest request, Map<Integer, MenuItem> menu, Map<Integer, Integer> demand) {
        for (CheckoutLine line : request.getLines()) {
            MenuItem item = menu.get(line.getMenuItemId());
            if (item == null) {
                item = menuDao.findById(line.getMenuItemId()).orElse(null);
                if (item == null) {
                    return CheckoutResult.failure(CheckoutResult.FailureType.NOT_FOUND, "Menu item not found: " + line.getMenuItemId(), null);
                }
                menu.put(line.getMenuItemId(), item);
            }
            if (!item.isInStock()) {
                return CheckoutResult.failure(CheckoutResult.FailureType.OUT_OF_STOCK, "Menu item out of stock: " + item.getName(), null);
            }
            demand.merge(line.getMenuItemId(), line.getQuantity(), Integer::sum);
        }
        for (Map.Entry<Integer, Integer> entry : demand.entrySet()) {
            MenuItem item = menu.get(entry.getKey());
            if (item.getStockQty() < entry.getValue()) {
                return CheckoutResult.failure(CheckoutResult.FailureType.OUT_OF_STOCK, "Insufficient stock for " + item.getName(), null);
            }
        }
        return null;
    }

    private Order buildOrder(CheckoutRequest request, Map<Integer, MenuItem> menu) {
        OrderBuilder builder = new OrderBuilder()
                .forCustomer(request.getCustomer() == null ? null : request.getCustomer().getName())
                .ofType(request.getOrderType())
                .withNote(request.getNote())
                .withPayment(request.getPaymentMethod(), false);
        if (request.getTableId() != null) {
            builder.atTable(request.getTableId());
        }
        for (CheckoutLine line : request.getLines()) {
            builder.addItem(decorate(menu.get(line.getMenuItemId()), line), line.getQuantity());
        }
        Order order = builder.build();
        order.recalculateTotals();

        DiscountContext discount = request.getDiscountStrategy() == null
                ? new DiscountContext() : new DiscountContext(request.getDiscountStrategy());
        order.setDiscountAmount(discount.executeDiscount(order.getSubtotal(), request.getCustomer()));
        order.recalculateTotals();
        return order;
    }

    private IBeverage decorate(MenuItem item, CheckoutLine line) {
        IBeverage beverage = new BaseCoffee(item);
        for (Customization customization : line.getCustomizations()) {
            beverage = switch (customization) {
                case SIZE_L -> new LargeSizeDecorator(beverage);
                case CHEESE_FOAM -> new CheeseFoamDecorator(beverage);
                case WHITE_PEARL -> new PearlToppingDecorator(beverage);
            };
        }
        return beverage;
    }

    private boolean reserveStock(Map<Integer, Integer> demand) {
        List<Integer> reserved = new ArrayList<>();
        for (Map.Entry<Integer, Integer> entry : demand.entrySet()) {
            if (!menuDao.updateStock(entry.getKey(), -entry.getValue())) {
                for (Integer id : reserved) {
                    menuDao.updateStock(id, demand.get(id));
                }
                return false;
            }
            reserved.add(entry.getKey());
        }
        return true;
    }

    private void releaseStock(Map<Integer, Integer> demand) {
        demand.forEach((id, qty) -> menuDao.updateStock(id, qty));
    }
}
