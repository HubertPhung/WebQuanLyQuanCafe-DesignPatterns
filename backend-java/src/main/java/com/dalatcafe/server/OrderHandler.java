package com.dalatcafe.server;

import com.dalatcafe.dao.ICustomerDao;
import com.dalatcafe.dao.IOrderDao;
import com.dalatcafe.model.Customer;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderItem;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.patterns.factory.PaymentProcessorFactory;
import com.dalatcafe.patterns.factory.PaymentResult;
import com.dalatcafe.patterns.observer.LoyaltyPointObserver;
import com.dalatcafe.patterns.observer.OrderEventSubject;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.BooleanSupplier;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * GET /api/orders, PATCH /api/orders/{code}/status (KDS lifecycle) and
 * POST /api/orders/{code}/pay (settles an unpaid order, e.g. one transferred from a reservation).
 * Paying fires {@code onOrderPaid}; reaching COMPLETED fires {@code onOrderCompleted}, so the
 * Observer pattern keeps the floor plan and the KDS in step with the kitchen.
 */
public class OrderHandler extends ApiHandler {
    private static final Logger LOGGER = Logger.getLogger(OrderHandler.class.getName());
    private static final List<OrderStatus> FLOW =
            List.of(OrderStatus.PENDING, OrderStatus.BREWING, OrderStatus.READY, OrderStatus.COMPLETED);

    private final IOrderDao orderDao;
    private final ICustomerDao customerDao;
    private final OrderEventSubject eventSubject;
    private final BooleanSupplier databaseHealthy;

    public OrderHandler(IOrderDao orderDao, ICustomerDao customerDao, OrderEventSubject eventSubject,
                        BooleanSupplier databaseHealthy) {
        this.orderDao = Objects.requireNonNull(orderDao, "Order DAO must not be null");
        this.customerDao = Objects.requireNonNull(customerDao, "Customer DAO must not be null");
        this.eventSubject = Objects.requireNonNull(eventSubject, "Event subject must not be null");
        this.databaseHealthy = Objects.requireNonNull(databaseHealthy, "Health check must not be null");
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        List<String> parts = segments(exchange);
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        if (parts.size() == 2) {
            if (!method.equals("GET")) {
                throw methodNotAllowed(exchange);
            }
            list(exchange);
            return;
        }
        if (parts.size() == 4 && parts.get(3).equals("status")) {
            if (!method.equals("PATCH") && !method.equals("PUT")) {
                throw methodNotAllowed(exchange);
            }
            updateStatus(exchange, parts.get(2));
            return;
        }
        if (parts.size() == 4 && parts.get(3).equals("pay")) {
            if (!method.equals("POST")) {
                throw methodNotAllowed(exchange);
            }
            pay(exchange, parts.get(2));
            return;
        }
        throw ApiException.notFound("Unknown order resource");
    }

    private void list(HttpExchange exchange) throws IOException {
        String status = queryParam(exchange, "status");
        List<Order> orders = status == null ? orderDao.findAll() : orderDao.findByStatus(parseStatus(status));
        List<Object> data = new ArrayList<>();
        orders.stream()
                .sorted(Comparator.comparing(Order::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .forEach(order -> data.add(toJson(order)));
        sendOk(exchange, 200, data, null);
    }

    private void updateStatus(HttpExchange exchange, String code) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        OrderStatus target = parseStatus(requireStr(body, "status"));
        Order order = find(code);
        OrderStatus current = order.getStatus();
        if (current == target) {
            sendOk(exchange, 200, toJson(order), "Order " + code + " is already " + label(target));
            return;
        }
        if (current == OrderStatus.COMPLETED || current == OrderStatus.CANCELLED) {
            throw conflict("Order " + code + " is closed (" + label(current) + ")");
        }
        if (target != OrderStatus.CANCELLED && FLOW.indexOf(target) < FLOW.indexOf(current)) {
            throw conflict("Order " + code + " cannot go back from " + label(current) + " to " + label(target));
        }
        if (target == OrderStatus.COMPLETED && order.getPaymentStatus() != PaymentStatus.PAID) {
            throw conflict("Order " + code + " must be paid before it is completed");
        }

        order.setStatus(target);
        if (target == OrderStatus.CANCELLED && order.getPaymentStatus() == PaymentStatus.PAID) {
            order.setPaymentStatus(PaymentStatus.REFUNDED);
        }
        save(order);

        List<String> warnings = new ArrayList<>();
        if (target == OrderStatus.COMPLETED) {
            try {
                eventSubject.notifyOrderCompleted(order);
            } catch (RuntimeException e) {
                LOGGER.log(Level.WARNING, "Order completed observer failed: " + e.getMessage(), e);
                warnings.add("Order event observer failed: " + e.getMessage());
            }
        }
        Map<String, Object> data = toJson(order);
        data.put("warnings", warnings);
        sendOk(exchange, 200, data, "Order " + code + " is now " + label(target));
    }

    private void pay(HttpExchange exchange, String code) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        if (!databaseHealthy.getAsBoolean()) {
            throw new ApiException(503, "DATABASE_UNAVAILABLE",
                    "The primary database is unavailable; payment was not taken. Please retry.");
        }
        PaymentMethod method = paymentMethod(requireStr(body, "paymentMethod"));
        Customer customer = phone(body);

        Order order;
        PaymentResult payment;
        // One payment per order even when two cashiers press "pay" at once.
        synchronized (this) {
            order = find(code);
            if (order.getPaymentStatus() == PaymentStatus.PAID) {
                throw conflict("Order " + code + " is already paid");
            }
            if (order.getStatus() == OrderStatus.CANCELLED) {
                throw conflict("Order " + code + " was cancelled");
            }
            order.recalculateTotals();
            try {
                payment = order.getTotal() <= 0
                        ? new PaymentResult(true, "NO-CHARGE-" + order.getOrderCode(), "Nothing to charge")
                        : PaymentProcessorFactory.createProcessor(method).processPayment(order.getTotal(), order.getOrderCode());
            } catch (RuntimeException e) {
                throw ApiException.badRequest("Payment error: " + e.getMessage());
            }
            if (payment == null || !payment.isSuccess()) {
                throw ApiException.badRequest(payment == null ? "Payment declined" : "Payment declined: " + payment.getMessage());
            }
            order.setPaymentMethod(method);
            order.setPaymentStatus(PaymentStatus.PAID);
            save(order);
        }

        List<String> warnings = new ArrayList<>();
        try {
            eventSubject.notifyOrderPaid(order);
            if (customer != null) {
                // Per-request observer called directly: the shared subject stays untouched.
                new LoyaltyPointObserver(customerDao, customer.getId()).onOrderPaid(order);
            }
        } catch (RuntimeException e) {
            LOGGER.log(Level.WARNING, "Order paid observer failed: " + e.getMessage(), e);
            warnings.add("Order event observer failed: " + e.getMessage());
        }
        Map<String, Object> data = toJson(order);
        data.put("transactionId", payment.getTransactionId());
        data.put("warnings", warnings);
        sendOk(exchange, 200, data, "Order " + code + " paid");
    }

    private Customer phone(Map<String, Object> body) {
        String phone = str(body, "customerPhone");
        if (phone == null) {
            return null;
        }
        Customer customer = customerDao.findByPhone(phone)
                .orElseThrow(() -> ApiException.notFound("Customer not found: " + phone));
        return customer.getId() == null ? null : customer;
    }

    private Order find(String code) {
        return orderDao.findByOrderCode(code).orElseThrow(() -> ApiException.notFound("Order not found: " + code));
    }

    private void save(Order order) {
        if (!orderDao.save(order)) {
            throw new ApiException(500, "INTERNAL_SERVER_ERROR", "Could not save order " + order.getOrderCode());
        }
    }

    private static ApiException conflict(String message) {
        return new ApiException(409, "RESOURCE_CONFLICT", message);
    }

    private static String label(OrderStatus status) {
        return status.name().toLowerCase(Locale.ROOT);
    }

    static OrderStatus parseStatus(String raw) {
        try {
            return OrderStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("status must be one of: pending, brewing, ready, completed, cancelled");
        }
    }

    private static PaymentMethod paymentMethod(String raw) {
        try {
            return PaymentMethod.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("paymentMethod must be one of: cash, qr, card");
        }
    }

    static Map<String, Object> toJson(Order order) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("orderCode", order.getOrderCode());
        json.put("customer", order.getCustomer());
        json.put("tableId", order.getTableId());
        json.put("orderType", order.getOrderType() == null ? null
                : order.getOrderType().name().toLowerCase(Locale.ROOT).replace('_', '-'));
        json.put("status", order.getStatus() == null ? null : label(order.getStatus()));
        json.put("paymentStatus", order.getPaymentStatus() == null ? null
                : order.getPaymentStatus().name().toLowerCase(Locale.ROOT));
        json.put("paymentMethod", order.getPaymentMethod() == null ? null
                : order.getPaymentMethod().name().toLowerCase(Locale.ROOT));
        List<Object> items = new ArrayList<>();
        for (OrderItem item : order.getItems()) {
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("menuItemId", item.getMenuItemId());
            line.put("name", item.getName());
            line.put("qty", item.getQty());
            line.put("price", item.getPrice());
            line.put("variation", item.getVariation());
            items.add(line);
        }
        json.put("items", items);
        json.put("subtotal", order.getSubtotal());
        json.put("discountAmount", order.getDiscountAmount());
        json.put("vatAmount", order.getVatAmount());
        json.put("total", order.getTotal());
        json.put("note", order.getNote());
        json.put("createdAt", order.getCreatedAt() == null ? null : order.getCreatedAt().toString());
        json.put("completedAt", order.getCompletedAt() == null ? null : order.getCompletedAt().toString());
        return json;
    }
}
