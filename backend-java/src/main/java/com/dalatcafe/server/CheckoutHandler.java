package com.dalatcafe.server;

import com.dalatcafe.dao.ICustomerDao;
import com.dalatcafe.model.Customer;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderType;
import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.patterns.facade.CheckoutLine;
import com.dalatcafe.patterns.facade.CheckoutRequest;
import com.dalatcafe.patterns.facade.CheckoutResult;
import com.dalatcafe.patterns.facade.Customization;
import com.dalatcafe.patterns.facade.PosCheckoutFacade;
import com.dalatcafe.patterns.observer.IOrderObserver;
import com.dalatcafe.patterns.observer.LoyaltyPointObserver;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import com.dalatcafe.patterns.strategy.IDiscountStrategy;
import com.dalatcafe.patterns.strategy.LoyaltyTierDiscountStrategy;
import com.dalatcafe.patterns.strategy.PointRedemptionDiscountStrategy;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.BooleanSupplier;

/**
 * POST /api/checkout: maps the JSON request to a {@link CheckoutRequest} and delegates to
 * {@link PosCheckoutFacade}. Answers 503 DATABASE_UNAVAILABLE instead of silently falling back
 * when the primary database is down (no money movement on a degraded store).
 */
public class CheckoutHandler extends ApiHandler {
    private final PosCheckoutFacade facade;
    private final ICustomerDao customerDao;
    private final BooleanSupplier databaseHealthy;

    public CheckoutHandler(PosCheckoutFacade facade, ICustomerDao customerDao, BooleanSupplier databaseHealthy) {
        this.facade = Objects.requireNonNull(facade, "Facade must not be null");
        this.customerDao = Objects.requireNonNull(customerDao, "Customer DAO must not be null");
        this.databaseHealthy = Objects.requireNonNull(databaseHealthy, "Health check must not be null");
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            throw methodNotAllowed(exchange);
        }
        if (segments(exchange).size() != 2) {
            throw ApiException.notFound("Unknown checkout resource");
        }
        Map<String, Object> body = readJsonBody(exchange);
        if (!databaseHealthy.getAsBoolean()) {
            throw new ApiException(503, "DATABASE_UNAVAILABLE",
                    "The primary database is unavailable; payment was not taken. Please retry.");
        }

        Customer known = findCustomer(str(body, "customerPhone"));
        int requestedPoints = requestedPoints(body, known);
        PointRedemptionDiscountStrategy redemption = requestedPoints > 0
                ? new PointRedemptionDiscountStrategy(discount(str(body, "voucherCode"), known), requestedPoints) : null;
        CheckoutRequest request = toRequest(body, known, redemption);
        PaymentMethod method = request.getPaymentMethod();
        Double tendered = num(body, "tenderedAmount");

        CheckoutResult result;
        int pointsRedeemed = 0;
        List<String> warnings = new ArrayList<>();
        // The subject is shared, so attaching a per-customer observer must be exclusive.
        synchronized (facade) {
            IOrderObserver loyalty = known != null && known.getId() != null
                    ? new LoyaltyPointObserver(customerDao, known.getId()) : null;
            if (loyalty != null) {
                facade.getEventSubject().attach(loyalty);
            }
            try {
                result = facade.checkout(request);
            } finally {
                if (loyalty != null) {
                    facade.getEventSubject().detach(loyalty);
                }
            }
            if (result.isSuccess() && redemption != null && redemption.getPointsUsed() > 0) {
                pointsRedeemed = redemption.getPointsUsed();
                if (!customerDao.redeemPoints(known.getId(), pointsRedeemed)) {
                    warnings.add("Loyalty points could not be deducted: " + pointsRedeemed);
                }
            }
        }

        if (!result.isSuccess()) {
            throw mapFailure(result);
        }
        Order order = result.getOrder();
        warnings.addAll(0, result.getWarnings());
        Map<String, Object> data = toResponse(order, tendered, method, result, known != null);
        data.put("warnings", warnings);
        data.put("pointsRedeemed", pointsRedeemed);
        data.put("pointsDiscountVnd", SystemConfigManager.getInstance().calculateDiscountFromPoints(pointsRedeemed));
        sendOk(exchange, 200, data, "Checkout completed");
    }

    /** Points the cashier wants to redeem; only a known member with enough balance may. */
    private static int requestedPoints(Map<String, Object> body, Customer known) {
        Double raw = num(body, "useLoyaltyPoints");
        if (raw == null || raw == 0) {
            return 0;
        }
        if (raw < 0 || raw != Math.floor(raw)) {
            throw ApiException.badRequest("useLoyaltyPoints must be a positive whole number");
        }
        if (known == null || known.getId() == null) {
            throw ApiException.badRequest("Redeeming points needs the phone number of a registered customer");
        }
        int points = raw.intValue();
        if (points > known.getLoyaltyPoints()) {
            throw new ApiException(400, "INSUFFICIENT_POINTS",
                    "Customer has " + known.getLoyaltyPoints() + " points, cannot redeem " + points);
        }
        return points;
    }

    private ApiException mapFailure(CheckoutResult result) {
        CheckoutResult.FailureType type = result.getFailureType();
        if (type == null) {
            return new ApiException(500, "INTERNAL_SERVER_ERROR", result.getMessage());
        }
        switch (type) {
            case NOT_FOUND:
                return ApiException.notFound(result.getMessage());
            case OUT_OF_STOCK:
                return new ApiException(409, "RESOURCE_CONFLICT", result.getMessage());
            case PAYMENT_FAILED:
                return new ApiException(400, "INVALID_INPUT", result.getMessage());
            default:
                return new ApiException(503, "DATABASE_UNAVAILABLE", result.getMessage());
        }
    }

    private Customer findCustomer(String phone) {
        if (phone == null) {
            return null;
        }
        return customerDao.findByPhone(phone).orElse(null);
    }

    private CheckoutRequest toRequest(Map<String, Object> body, Customer known, IDiscountStrategy redemption) {
        List<Object> rawLines = list(body, "lines");
        if (rawLines.isEmpty()) {
            throw ApiException.badRequest("Field 'lines' must contain at least one item");
        }
        List<CheckoutLine> lines = new ArrayList<>();
        for (Object raw : rawLines) {
            Map<String, Object> line = asObject(raw, "lines entry");
            int qty = requireInt(line, "qty");
            if (qty <= 0) {
                throw ApiException.badRequest("Line qty must be greater than zero");
            }
            lines.add(new CheckoutLine(requireInt(line, "menuItemId"), qty, customizations(line)));
        }

        Customer customer = known;
        String name = str(body, "customer");
        if (customer == null && name != null) {
            customer = new Customer(null, name, str(body, "customerPhone"), null);
        }
        Integer tableId = body.get("tableId") == null ? null : requireInt(body, "tableId");
        if (tableId != null && tableId <= 0) {
            throw ApiException.badRequest("tableId must be greater than zero");
        }
        return new CheckoutRequest(lines, tableId, orderType(str(body, "orderType")),
                paymentMethod(requireStr(body, "paymentMethod")), customer,
                redemption != null ? redemption : discount(str(body, "voucherCode"), known), str(body, "note"));
    }

    private static Set<Customization> customizations(Map<String, Object> line) {
        Set<Customization> set = EnumSet.noneOf(Customization.class);
        String size = str(line, "size");
        if (size != null) {
            if (size.equalsIgnoreCase("L")) {
                set.add(Customization.SIZE_L);
            } else if (!size.equalsIgnoreCase("M") && !size.equalsIgnoreCase("S")) {
                throw ApiException.badRequest("Unknown size: " + size);
            }
        }
        for (Object topping : list(line, "toppings")) {
            set.add(toppingToCustomization(String.valueOf(topping)));
        }
        for (Object custom : list(line, "customizations")) {
            try {
                set.add(Customization.valueOf(String.valueOf(custom).trim().toUpperCase(Locale.ROOT)));
            } catch (IllegalArgumentException e) {
                throw ApiException.badRequest("Unknown customization: " + custom);
            }
        }
        return set;
    }

    private static Customization toppingToCustomization(String topping) {
        String t = topping.trim().toLowerCase(Locale.ROOT);
        if (t.contains("trân châu") || t.contains("pearl")) {
            return Customization.WHITE_PEARL;
        }
        if (t.contains("phô mai") || t.contains("cheese") || t.contains("foam")) {
            return Customization.CHEESE_FOAM;
        }
        throw ApiException.badRequest("Unknown topping: " + topping);
    }

    private static IDiscountStrategy discount(String voucher, Customer known) {
        if (voucher != null) {
            return VoucherCatalog.find(voucher).orElseThrow(() ->
                    new ApiException(400, "INVALID_VOUCHER", "Invalid voucher code: " + voucher));
        }
        return known != null ? new LoyaltyTierDiscountStrategy() : null;
    }

    private static OrderType orderType(String raw) {
        if (raw == null) {
            return OrderType.DINE_IN;
        }
        try {
            return OrderType.valueOf(raw.trim().toUpperCase(Locale.ROOT).replace('-', '_'));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("orderType must be one of: dine-in, pickup, delivery");
        }
    }

    private static PaymentMethod paymentMethod(String raw) {
        try {
            return PaymentMethod.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("paymentMethod must be one of: cash, qr, card");
        }
    }

    private static Map<String, Object> toResponse(Order order, Double tendered, PaymentMethod method,
                                                  CheckoutResult result, boolean earnsPoints) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("orderCode", order.getOrderCode());
        data.put("subtotal", order.getSubtotal());
        data.put("discountAmount", order.getDiscountAmount());
        data.put("vatAmount", order.getVatAmount());
        data.put("finalTotal", order.getTotal());
        double change = method == PaymentMethod.CASH && tendered != null
                ? Math.max(0, tendered - order.getTotal()) : 0;
        data.put("changeDue", change);
        data.put("paymentStatus", order.getPaymentStatus().name().toLowerCase(Locale.ROOT));
        data.put("pointsEarned", earnsPoints
                ? SystemConfigManager.getInstance().calculateLoyaltyPoints(order.getTotal()) : 0);
        data.put("transactionId", result.getPaymentResult().getTransactionId());
        data.put("warnings", result.getWarnings());
        return data;
    }
}
