package com.dalatcafe.patterns.facade;

import com.dalatcafe.dao.DaoFactory;
import com.dalatcafe.dao.IMenuDao;
import com.dalatcafe.dao.IOrderDao;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.PaymentMethod;
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
import java.util.OptionalDouble;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Facade Pattern (GoF Structural): một điểm vào duy nhất {@link #checkout(CheckoutRequest)} điều
 * phối OrderBuilder, BeverageDecorator, DiscountStrategy, PaymentProcessorFactory,
 * OrderEventSubject và tầng DAO. Tính nhất quán: mọi dòng phải đang được bán (công tắc in-stock;
 * không theo dõi số lượng), sau đó mới thu tiền, rồi mới lưu đơn. Lỗi xảy ra trước khi lưu thì
 * không ghi gì. Observer chạy sau khi lưu; lỗi của chúng chỉ thành cảnh báo, không bao giờ hoàn tác
 * đơn.
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
     * Thực hiện toàn bộ checkout. Không ném ngoại lệ cho lỗi nghiệp vụ; hãy xem kết quả trả về.
     */
    public synchronized CheckoutResult checkout(CheckoutRequest request) {
        Objects.requireNonNull(request, "Request must not be null");

        Map<Integer, MenuItem> menu = new LinkedHashMap<>();
        CheckoutResult problem = resolveMenu(request, menu);
        if (problem != null) {
            return problem;
        }

        // Bước 1-3: bọc đồ uống bằng Decorator, dựng đơn, áp giảm giá.
        Order order = buildOrder(request, menu);
        Double tendered = request.getTenderedAmount();
        if (request.getPaymentMethod() == PaymentMethod.CASH && tendered != null && tendered < order.getTotal()) {
            return CheckoutResult.failure(CheckoutResult.FailureType.PAYMENT_FAILED,
                    "Cash tendered " + tendered + " does not cover the total " + order.getTotal(), null);
        }

        // Bước 4: thanh toán.
        PaymentResult payment;
        try {
            if (order.getTotal() <= 0) {
                // Đơn được giảm hết tiền: bộ xử lý thanh toán từ chối số tiền 0, nên không thu gì.
                payment = new PaymentResult(true, "NO-CHARGE-" + order.getOrderCode(), "Nothing to charge");
            } else {
                IPaymentProcessor processor = PaymentProcessorFactory.createProcessor(request.getPaymentMethod());
                payment = processor.processPayment(order.getTotal(), order.getOrderCode());
            }
        } catch (RuntimeException e) {
            return CheckoutResult.failure(CheckoutResult.FailureType.PAYMENT_FAILED, "Payment error: " + e.getMessage(), null);
        }
        if (payment == null || !payment.isSuccess()) {
            return CheckoutResult.failure(CheckoutResult.FailureType.PAYMENT_FAILED,
                    payment == null ? "Payment declined" : "Payment declined: " + payment.getMessage(), payment);
        }

        // Bước 5: lưu đơn đã thanh toán; đơn chờ trên KDS cho tới khi quầy pha chế hoàn tất.
        order.setPaymentStatus(PaymentStatus.PAID);
        order.setStatus(OrderStatus.PENDING);
        boolean saved;
        try {
            saved = orderDao.save(order);
        } catch (RuntimeException e) {
            LOGGER.log(Level.SEVERE, "Order save failed after payment " + payment.getTransactionId(), e);
            saved = false;
        }
        if (!saved) {
            return CheckoutResult.failure(CheckoutResult.FailureType.PERSISTENCE_FAILED, "Order could not be saved (payment "
                    + payment.getTransactionId() + " must be voided)", payment);
        }

        // Bước 6: phát sự kiện; lỗi của observer không được hoàn tác một lần checkout đã lưu.
        List<String> warnings = new ArrayList<>();
        try {
            eventSubject.notifyOrderPaid(order);
        } catch (RuntimeException e) {
            LOGGER.log(Level.WARNING, "Order event observer failed: " + e.getMessage(), e);
            warnings.add("Order event observer failed: " + e.getMessage());
        }
        return CheckoutResult.success(order, payment, warnings);
    }

    /**
     * Tạm tính của đơn theo đúng giá thực đơn và phụ thu mà checkout sẽ dùng, không thu tiền và
     * không lưu gì. Rỗng khi một món không còn hoặc đã hết; checkout sẽ báo lỗi đó.
     */
    public OptionalDouble subtotalOf(CheckoutRequest request) {
        Objects.requireNonNull(request, "Request must not be null");
        Map<Integer, MenuItem> menu = new LinkedHashMap<>();
        if (resolveMenu(request, menu) != null) {
            return OptionalDouble.empty();
        }
        return OptionalDouble.of(buildOrder(request.withDiscount(null, null), menu).getSubtotal());
    }

    private CheckoutResult resolveMenu(CheckoutRequest request, Map<Integer, MenuItem> menu) {
        for (CheckoutLine line : request.getLines()) {
            MenuItem item = menu.get(line.getMenuItemId());
            if (item == null) {
                item = menuDao.findById(line.getMenuItemId()).orElse(null);
                if (item == null) {
                    return CheckoutResult.failure(CheckoutResult.FailureType.NOT_FOUND, "Menu item not found: " + line.getMenuItemId(), null);
                }
                menu.put(line.getMenuItemId(), item);
            }
            // Không theo dõi số lượng: một món được bán khi công tắc in-stock của nó đang bật.
            if (!item.isInStock()) {
                return CheckoutResult.failure(CheckoutResult.FailureType.OUT_OF_STOCK, "Menu item out of stock: " + item.getName(), null);
            }
        }
        return null;
    }

    private Order buildOrder(CheckoutRequest request, Map<Integer, MenuItem> menu) {
        DiscountContext discount = request.getDiscountStrategy() == null
                ? new DiscountContext() : new DiscountContext(request.getDiscountStrategy());
        OrderBuilder builder = new OrderBuilder()
                .forCustomer(request.getCustomer() == null ? null : request.getCustomer().getName())
                .ofType(request.getOrderType())
                .withNote(request.getNote())
                .withPayment(request.getPaymentMethod(), false)
                .avoidingCodes(code -> orderDao.findByOrderCode(code).isPresent())
                .discountedBy(subtotal -> discount.executeDiscount(subtotal, request.getCustomer()));
        if (request.getTableId() != null) {
            builder.atTable(request.getTableId());
        }
        for (CheckoutLine line : request.getLines()) {
            builder.addItem(line.getMenuItemId(), decorate(menu.get(line.getMenuItemId()), line), line.getQuantity());
        }
        Order order = builder.build();
        order.setBranch(request.getBranch());
        order.setVoucherCode(request.getVoucherCode());
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
}
