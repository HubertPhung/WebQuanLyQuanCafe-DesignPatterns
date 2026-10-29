package com.dalatcafe.server;

import com.dalatcafe.dao.DaoFactory;
import com.dalatcafe.dao.ICustomerDao;
import com.dalatcafe.dao.ITableDao;
import com.dalatcafe.dao.IOrderDao;
import com.dalatcafe.dao.IReservationDao;
import com.dalatcafe.model.Customer;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderType;
import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.patterns.facade.CheckoutLine;
import com.dalatcafe.patterns.facade.CheckoutRequest;
import com.dalatcafe.patterns.facade.CheckoutResult;
import com.dalatcafe.patterns.facade.Customization;
import com.dalatcafe.patterns.facade.PosCheckoutFacade;
import com.dalatcafe.patterns.observer.LoyaltyPointObserver;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import com.dalatcafe.patterns.strategy.IDiscountStrategy;
import com.dalatcafe.patterns.strategy.LoyaltyTierDiscountStrategy;
import com.dalatcafe.patterns.strategy.PointRedemptionDiscountStrategy;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.time.Clock;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.OptionalDouble;
import java.util.Set;
import java.util.function.BooleanSupplier;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * POST /api/checkout: chuyển JSON request thành {@link CheckoutRequest} và giao cho {@link
 * PosCheckoutFacade}. Trả 503 DATABASE_UNAVAILABLE thay vì âm thầm chuyển sang dự phòng khi
 * database chính bị mất (không có giao dịch tiền nào trên kho đang suy giảm).
 */
public class CheckoutHandler extends ApiHandler {
    private static final Logger LOGGER = Logger.getLogger(CheckoutHandler.class.getName());

    private final PosCheckoutFacade facade;
    private final ICustomerDao customerDao;
    private final ITableDao tableDao;
    private final IOrderDao orderDao;
    private final IReservationDao reservationDao;
    private final BooleanSupplier databaseHealthy;
    private final VoucherService vouchers;

    public CheckoutHandler(PosCheckoutFacade facade, ICustomerDao customerDao, ITableDao tableDao,
                           BooleanSupplier databaseHealthy) {
        this(facade, customerDao, tableDao, null, null, databaseHealthy);
    }

    public CheckoutHandler(PosCheckoutFacade facade, ICustomerDao customerDao, ITableDao tableDao,
                           IOrderDao orderDao, IReservationDao reservationDao, BooleanSupplier databaseHealthy) {
        this(facade, customerDao, tableDao, orderDao, reservationDao,
                new VoucherService(DaoFactory.getInstance().getVoucherDao(), Clock.systemUTC()), databaseHealthy);
    }

    public CheckoutHandler(PosCheckoutFacade facade, ICustomerDao customerDao, ITableDao tableDao,
                           IOrderDao orderDao, IReservationDao reservationDao, VoucherService vouchers,
                           BooleanSupplier databaseHealthy) {
        this.vouchers = Objects.requireNonNull(vouchers, "Voucher service must not be null");
        this.facade = Objects.requireNonNull(facade, "Facade must not be null");
        this.customerDao = Objects.requireNonNull(customerDao, "Customer DAO must not be null");
        this.tableDao = Objects.requireNonNull(tableDao, "Table DAO must not be null");
        this.orderDao = orderDao;
        this.reservationDao = reservationDao;
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
        boolean storefront = Boolean.TRUE.equals(exchange.getAttribute(SimpleAuthFilter.STOREFRONT_SERVICE_ATTRIBUTE));
        // Tài khoản của khách chỉ được tin khi storefront gọi bằng service key.
        Integer userId = storefront && body.get("userId") != null ? requireInt(body, "userId") : null;
        String voucherCode = VoucherService.normalize(str(body, "voucherCode"));
        if (!databaseHealthy.getAsBoolean()) {
            throw new ApiException(503, "DATABASE_UNAVAILABLE",
                    "The primary database is unavailable; payment was not taken. Please retry.");
        }

        Customer known;
        CheckoutRequest request;
        Double tendered;
        CheckoutResult result;
        int pointsRedeemed = 0;
        List<String> warnings = new ArrayList<>();
        // Thành viên được đọc và tính tiền trong cùng một khóa, nên hai lượt checkout không thể
        // cùng tiêu một số dư điểm. Mỗi thay đổi điểm được DAO áp dụng nguyên tử, nên /pay chạy
        // đồng thời không ghi đè được.
        synchronized (facade) {
            known = findCustomer(str(body, "customerPhone"));
            int requestedPoints = requestedPoints(body, known);
            tendered = num(body, "tenderedAmount");
            if (tendered != null && tendered < 0) {
                throw ApiException.badRequest("tenderedAmount must not be negative");
            }
            // Giảm giá được tính trên bản chụp này: thành viên thật bị trừ điểm ở bên dưới.
            CheckoutRequest undiscounted = toRequest(body, known == null ? null : snapshot(known), null, tendered);

            // Lượt voucher được giữ trên đúng tạm tính của đơn, trước khi thu tiền; đơn không thành
            // thì lượt được trả ở finally bên dưới. Món thiếu hoặc hết thì không giữ lượt nào:
            // checkout sẽ báo lỗi đó.
            VoucherService.Redemption voucher = null;
            OptionalDouble subtotal = voucherCode == null ? OptionalDouble.empty() : facade.subtotalOf(undiscounted);
            if (subtotal.isPresent()) {
                voucher = vouchers.redeem(voucherCode, subtotal.getAsDouble(), userId, null, storefront);
            }
            IDiscountStrategy base = voucher != null ? voucher.strategy() : (known != null ? new LoyaltyTierDiscountStrategy() : null);
            PointRedemptionDiscountStrategy redemption = requestedPoints > 0
                    ? new PointRedemptionDiscountStrategy(base, requestedPoints) : null;
            request = undiscounted.withDiscount(redemption != null ? redemption : base,
                    voucher == null ? null : voucher.voucher().getCode());

            result = null;
            try {
                // Điểm được giữ trước khi thu tiền, nên không bao giờ giảm giá cho số điểm không
                // trừ được. Phần strategy không dùng tới được hoàn lại sau đó.
                if (redemption != null && !customerDao.redeemPoints(known.getId(), requestedPoints)) {
                    throw new ApiException(503, "DATABASE_UNAVAILABLE",
                            "Loyalty points could not be deducted; payment was not taken. Please retry.");
                }
                try {
                    result = facade.checkout(request);
                    if (result.isSuccess() && known == null && bool(body, "enrollMember", false)) {
                        known = enrollMember(body, warnings);
                    }
                    if (result.isSuccess() && known != null && known.getId() != null) {
                        // Gọi trực tiếp trên đơn này, không gắn vào subject dùng chung: /pay và
                        // /sync phát sự kiện ở đó trong một khóa khác, và đơn của chúng không được
                        // cộng điểm cho thành viên này.
                        try {
                            new LoyaltyPointObserver(customerDao, known.getId()).onOrderPaid(result.getOrder());
                        } catch (RuntimeException e) {
                            warnings.add("Loyalty points could not be added: " + e.getMessage());
                        }
                    }
                    if (result.isSuccess() && redemption != null) {
                        pointsRedeemed = redemption.getPointsUsed();
                    }
                    if (result.isSuccess() && voucher != null) {
                        vouchers.attachOrder(voucher, result.getOrder().getOrderCode());
                    }
                } finally {
                    int unused = redemption == null ? 0 : requestedPoints - pointsRedeemed;
                    if (unused > 0 && !customerDao.restorePoints(known.getId(), unused)) {
                        LOGGER.severe("Could not give back " + unused + " loyalty points to customer " + known.getId());
                        warnings.add("Unused loyalty points could not be given back: " + unused);
                    }
                }
            } finally {
                if (voucher != null && (result == null || !result.isSuccess()) && !vouchers.release(voucher)) {
                    LOGGER.severe("Could not give back voucher use " + voucher.usageId());
                }
            }
        }

        if (!result.isSuccess()) {
            throw mapFailure(result);
        }
        Order order = result.getOrder();
        warnings.addAll(0, result.getWarnings());
        Map<String, Object> data = toResponse(order, tendered, request.getPaymentMethod(), result, known != null);
        data.put("warnings", warnings);
        data.put("pointsRedeemed", pointsRedeemed);
        data.put("pointsDiscountVnd", SystemConfigManager.getInstance().calculateDiscountFromPoints(pointsRedeemed));
        sendOk(exchange, 200, data, "Checkout completed");
    }

    /** Số điểm thu ngân muốn đổi; chỉ thành viên đã biết và đủ số dư mới được đổi. */
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

    /**
     * Đơn storefront đã thanh toán sẽ đăng ký người mua làm thành viên ở đơn đầu tiên, để đơn đó
     * được cộng điểm như của thành viên. Thành viên mới bắt đầu ở hạng BRONZE (không giảm giá), nên
     * số tiền đã thu là đúng.
     */
    private Customer enrollMember(Map<String, Object> body, List<String> warnings) {
        String phone = str(body, "customerPhone");
        if (phone == null) {
            return null;
        }
        String name = str(body, "customer");
        Customer member = new Customer(null, name == null ? phone : name, phone, str(body, "customerEmail"));
        try {
            if (customerDao.save(member) && member.getId() != null) {
                return member;
            }
        } catch (RuntimeException e) {
            LOGGER.log(Level.WARNING, "Could not enrol member " + phone, e);
        }
        warnings.add("Membership could not be created; no loyalty points were added.");
        return null;
    }

    private Customer findCustomer(String phone) {
        if (phone == null) {
            return null;
        }
        return customerDao.findByPhone(phone).orElse(null);
    }

    /**
     * DAO trong bộ nhớ trả về dòng đang dùng; phần tính giá không được thấy số điểm đã giữ từ dòng
     * đó.
     */
    private static Customer snapshot(Customer live) {
        Customer copy = new Customer(live.getId(), live.getName(), live.getPhone(), live.getEmail());
        copy.setTotalOrders(live.getTotalOrders());
        copy.setTotalSpent(live.getTotalSpent());
        copy.setLoyaltyPoints(live.getLoyaltyPoints());
        copy.setRank(live.getRank());
        copy.setLastVisit(live.getLastVisit());
        return copy;
    }

    private CheckoutRequest toRequest(Map<String, Object> body, Customer known, IDiscountStrategy discount,
                                      Double tendered) {
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
        // Kiểm tra trước khi facade thu tiền: bàn không tồn tại sẽ chỉ báo lỗi sau khi đã thanh
        // toán.
        com.dalatcafe.model.Table table = tableId == null ? null
                : tableDao.findById(tableId).orElseThrow(() -> ApiException.notFound("Table not found: " + tableId));
        // Đơn ăn tại chỗ thuộc chi nhánh của bàn; đơn mang đi hoặc giao hàng tự ghi chi nhánh của
        // nó.
        String branch = branchField(body);
        if (table != null) {
            if (branch != null && !branch.equals(table.getBranch())) {
                throw ApiException.badRequest("Bàn " + table.getName() + " không thuộc chi nhánh này.");
            }
            branch = table.getBranch();
            var orders = orderDao == null ? List.<Order>of() : orderDao.findAll();
            var reservations = reservationDao == null ? List.<com.dalatcafe.model.Reservation>of() : reservationDao.findAll();
            if (TableUsage.status(table, orders, reservations, java.time.Instant.now()) != com.dalatcafe.model.TableStatus.AVAILABLE) {
                throw new ApiException(409, "TABLE_UNAVAILABLE", "Bàn đang được sử dụng, đã có lịch đặt hoặc đang dọn. Vui lòng chọn bàn trống.");
            }
        }
        return new CheckoutRequest(lines, tableId, orderType(str(body, "orderType")),
                paymentMethod(requireStr(body, "paymentMethod")), customer, discount, str(body, "note"), tendered, branch);
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
        data.put("voucherCode", order.getVoucherCode());
        data.put("vatAmount", order.getVatAmount());
        data.put("finalTotal", order.getTotal());
        data.put("shippingFee", order.getShippingFee());
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
