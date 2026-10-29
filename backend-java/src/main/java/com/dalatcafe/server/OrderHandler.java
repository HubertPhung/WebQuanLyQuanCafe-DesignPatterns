package com.dalatcafe.server;

import com.dalatcafe.dao.ICustomerDao;
import com.dalatcafe.dao.IMenuDao;
import com.dalatcafe.dao.IOrderDao;
import com.dalatcafe.dao.ITableDao;
import com.dalatcafe.model.Customer;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderItem;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.OrderType;
import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.patterns.factory.PaymentProcessorFactory;
import com.dalatcafe.patterns.factory.PaymentResult;
import com.dalatcafe.patterns.observer.LoyaltyPointObserver;
import com.dalatcafe.patterns.observer.OrderEventSubject;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
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
 * GET /api/orders, PATCH /api/orders/{code}/status (vòng đời KDS) và POST /api/orders/{code}/pay
 * (thanh toán đơn chưa trả, ví dụ đơn chuyển từ phiếu đặt bàn). Thanh toán phát {@code
 * onOrderPaid}; chuyển sang COMPLETED phát {@code onOrderCompleted}, để Observer pattern giữ sơ đồ
 * bàn và KDS khớp với quầy pha chế. POST /api/orders/sync nhập các đơn frontend đã ghi khi backend
 * này offline.
 */
public class OrderHandler extends ApiHandler {
    private static final Logger LOGGER = Logger.getLogger(OrderHandler.class.getName());
    static final int MAX_SYNC_BATCH = 200;
    private static final List<OrderStatus> FLOW =
            List.of(OrderStatus.PENDING, OrderStatus.BREWING, OrderStatus.READY, OrderStatus.COMPLETED);

    private final IOrderDao orderDao;
    private final IMenuDao menuDao;
    private final ITableDao tableDao;
    private final ICustomerDao customerDao;
    private final OrderEventSubject eventSubject;
    private final BooleanSupplier databaseHealthy;
    private final VoucherService vouchers;

    public OrderHandler(IOrderDao orderDao, IMenuDao menuDao, ITableDao tableDao, ICustomerDao customerDao,
                        OrderEventSubject eventSubject, BooleanSupplier databaseHealthy) {
        this(orderDao, menuDao, tableDao, customerDao, eventSubject,
                new VoucherService(com.dalatcafe.dao.DaoFactory.getInstance().getVoucherDao(), java.time.Clock.systemUTC()),
                databaseHealthy);
    }

    public OrderHandler(IOrderDao orderDao, IMenuDao menuDao, ITableDao tableDao, ICustomerDao customerDao,
                        OrderEventSubject eventSubject, VoucherService vouchers, BooleanSupplier databaseHealthy) {
        this.vouchers = Objects.requireNonNull(vouchers, "Voucher service must not be null");
        this.orderDao = Objects.requireNonNull(orderDao, "Order DAO must not be null");
        this.menuDao = Objects.requireNonNull(menuDao, "Menu DAO must not be null");
        this.tableDao = Objects.requireNonNull(tableDao, "Table DAO must not be null");
        this.customerDao = Objects.requireNonNull(customerDao, "Customer DAO must not be null");
        this.eventSubject = Objects.requireNonNull(eventSubject, "Event subject must not be null");
        this.databaseHealthy = Objects.requireNonNull(databaseHealthy, "Health check must not be null");
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        List<String> parts = segments(exchange);
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        if (parts.size() == 3 && parts.get(2).equals("pay-tables") && method.equals("POST")) {
            payTables(exchange);
            return;
        }
        if (parts.size() == 2) {
            if (!method.equals("GET")) {
                throw methodNotAllowed(exchange);
            }
            list(exchange);
            return;
        }
        if (parts.size() == 3 && parts.get(2).equals("sync")) {
            if (!method.equals("POST")) {
                throw methodNotAllowed(exchange);
            }
            sync(exchange);
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
        String branch = branchFilter(exchange);
        List<Order> orders = status == null ? orderDao.findAll() : orderDao.findByStatus(parseStatus(status));
        List<Object> data = new ArrayList<>();
        orders.stream()
                .filter(order -> branch == null || branch.equals(order.getBranch()))
                .sorted(Comparator.comparing(Order::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .forEach(order -> data.add(toJson(order)));
        sendOk(exchange, 200, data, null);
    }

    private void payTables(HttpExchange exchange) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        List<Object> rawIds = list(body, "tableIds");
        if (rawIds.size() < 2 || rawIds.size() > 10) throw ApiException.badRequest("Chọn từ 2 đến 10 bàn để thanh toán gộp.");
        List<Integer> tableIds = new ArrayList<>();
        for (Object raw : rawIds) {
            if (raw == null) throw ApiException.badRequest("Mã bàn không hợp lệ.");
            int id = requireInt(Map.of("id", raw), "id");
            if (id < 1 || tableIds.contains(id)) throw ApiException.badRequest("Mã bàn bị trùng hoặc không hợp lệ.");
            if (tableDao.findById(id).isEmpty()) throw ApiException.notFound("Table not found: " + id);
            tableIds.add(id);
        }
        PaymentMethod method = paymentMethod(requireStr(body, "paymentMethod"));
        String transaction;
        double total;
        List<Order> orders;
        List<String> warnings = new ArrayList<>();
        synchronized (this) {
            if (!databaseHealthy.getAsBoolean()) throw new ApiException(503, "DATABASE_UNAVAILABLE", "Chưa thể thu tiền khi cơ sở dữ liệu gián đoạn.");
            orders = orderDao.findAll().stream().filter(order -> order.getPaymentStatus() == PaymentStatus.UNPAID
                    && order.getStatus() != OrderStatus.CANCELLED && order.getOrderType() == OrderType.DINE_IN
                    && order.getTableIds().stream().anyMatch(tableIds::contains)).toList();
            for (int id : tableIds) if (orders.stream().noneMatch(order -> order.getTableIds().contains(id))) {
                throw conflict("Bàn " + id + " không còn đơn chưa thanh toán.");
            }
            if (orders.stream().anyMatch(order -> !tableIds.containsAll(order.getTableIds()))) throw conflict("Cần chọn đủ các bàn thuộc cùng một phiếu đặt bàn.");
            total = orders.stream().mapToDouble(Order::getTotal).sum();
            Double expected = num(body, "expectedTotal");
            if (expected != null && Math.abs(expected - total) > 0.01) throw conflict("Hóa đơn vừa thay đổi. Vui lòng kiểm tra lại tổng tiền.");
            Double tendered = num(body, "tenderedAmount");
            if (method == PaymentMethod.CASH && (tendered == null || tendered < total)) throw ApiException.badRequest("Tiền khách đưa chưa đủ tổng hóa đơn gộp.");
            transaction = "GROUP-" + java.util.UUID.randomUUID();
            final double amount = total;
            final String reference = transaction;
            if (!orderDao.markPaidTogether(orders.stream().map(Order::getId).toList(), method, () -> {
                PaymentResult payment = amount <= 0 ? new PaymentResult(true, reference, "Nothing to charge")
                        : PaymentProcessorFactory.createProcessor(method).processPayment(amount, reference);
                if (payment == null || !payment.isSuccess()) throw ApiException.badRequest("Thanh toán không thành công.");
                return true;
            })) throw new ApiException(503, "DATABASE_UNAVAILABLE", "Không thể ghi nhận toàn bộ thanh toán gộp.");
            for (Order order : orders) {
                order.setPaymentMethod(method);
                order.setPaymentStatus(PaymentStatus.PAID);
                try { eventSubject.notifyOrderPaid(order); }
                catch (RuntimeException error) { warnings.add(error.getMessage()); }
            }
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("transactionId", transaction); data.put("tableIds", tableIds); data.put("total", total);
        data.put("orders", orders.stream().map(OrderHandler::toJson).toList()); data.put("warnings", warnings);
        sendOk(exchange, 200, data, "Đã thanh toán gộp các bàn");
    }

    private void updateStatus(HttpExchange exchange, String code) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        OrderStatus target = parseStatus(requireStr(body, "status"));
        Order order;
        boolean changed;
        // Cùng khóa với pay(): lệnh hủy đọc trước khi thanh toán không được ghi đè đơn về trạng
        // thái chưa trả.
        synchronized (this) {
            order = find(code);
            changed = order.getStatus() != target;
            if (changed) {
                applyStatus(order, code, target);
            }
        }
        if (!changed) {
            sendOk(exchange, 200, toJson(order), "Order " + code + " is already " + label(target));
            return;
        }

        List<String> warnings = new ArrayList<>();
        if (target == OrderStatus.COMPLETED || target == OrderStatus.CANCELLED) {
            try {
                if (target == OrderStatus.CANCELLED) eventSubject.notifyOrderCancelled(order);
                else eventSubject.notifyOrderCompleted(order);
            } catch (RuntimeException e) {
                LOGGER.log(Level.WARNING, "Order completed observer failed: " + e.getMessage(), e);
                warnings.add("Order event observer failed: " + e.getMessage());
            }
        }
        Map<String, Object> data = toJson(order);
        data.put("warnings", warnings);
        sendOk(exchange, 200, data, "Order " + code + " is now " + label(target));
    }

    private void applyStatus(Order order, String code, OrderStatus target) {
        OrderStatus current = order.getStatus();
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
        List<String> warnings = new ArrayList<>();
        // Mỗi đơn chỉ thanh toán một lần kể cả khi hai thu ngân cùng bấm "thanh toán". Sự kiện đã
        // thanh toán được gửi trong cùng khóa, nên lệnh hủy hay hoàn tất không thể chen vào trước
        // các tác động đi kèm.
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

            try {
                eventSubject.notifyOrderPaid(order);
                if (customer != null) {
                    // Observer theo từng request được gọi trực tiếp: subject dùng chung không bị
                    // đụng tới.
                    new LoyaltyPointObserver(customerDao, customer.getId()).onOrderPaid(order);
                }
            } catch (RuntimeException e) {
                LOGGER.log(Level.WARNING, "Order paid observer failed: " + e.getMessage(), e);
                warnings.add("Order event observer failed: " + e.getMessage());
            }
        }
        Map<String, Object> data = toJson(order);
        data.put("transactionId", payment.getTransactionId());
        data.put("warnings", warnings);
        sendOk(exchange, 200, data, "Order " + code + " paid");
    }

    /**
     * Nhập một lô đơn đã ghi ở nơi khác (frontend trong lúc backend này ngừng hoạt động). Không thu
     * tiền: tiền đã trao tay rồi. Idempotent theo mã đơn, nên gửi lại một lô không bao giờ tạo đơn
     * trùng.
     */
    private void sync(HttpExchange exchange) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        if (!databaseHealthy.getAsBoolean()) {
            throw new ApiException(503, "DATABASE_UNAVAILABLE", "The primary database is unavailable; nothing was imported.");
        }
        List<Object> batch = list(body, "orders");
        if (batch.isEmpty() || batch.size() > MAX_SYNC_BATCH) {
            throw ApiException.badRequest("Field 'orders' must hold 1 to " + MAX_SYNC_BATCH + " orders");
        }
        List<Object> results = new ArrayList<>();
        int created = 0;
        int existing = 0;
        int failed = 0;
        for (Object raw : batch) {
            Map<String, Object> row = new LinkedHashMap<>();
            String code = null;
            try {
                Map<String, Object> input = asObject(raw, "orders entry");
                code = requireStr(input, "orderCode");
                row.put("orderCode", code);
                List<String> warnings = new ArrayList<>();
                // Đồng bộ với pay(): việc nhập và thanh toán cùng một mã không thể xen kẽ nhau.
                synchronized (this) {
                    if (orderDao.findByOrderCode(code).isPresent()) {
                        row.put("result", "exists");
                        existing++;
                        results.add(row);
                        continue;
                    }
                    Order order = importedOrder(input, code, warnings);
                    save(order);
                    // Đơn đã bị hủy trước khi kịp đồng bộ: trả lại lượt voucher nó đã giữ.
                    if (order.getStatus() == OrderStatus.CANCELLED) {
                        vouchers.releaseOrder(code);
                    }
                    notifyImported(order, warnings);
                }
                row.put("result", "created");
                row.put("warnings", warnings);
                created++;
            } catch (ApiException e) {
                row.put("orderCode", code);
                row.put("result", "failed");
                row.put("error", e.getMessage());
                failed++;
            }
            results.add(row);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("created", created);
        data.put("existing", existing);
        data.put("failed", failed);
        data.put("results", results);
        sendOk(exchange, 200, data, created + " order(s) imported");
    }

    private Order importedOrder(Map<String, Object> input, String code, List<String> warnings) {
        Integer tableId = input.get("tableId") == null ? null : requireInt(input, "tableId");
        if (tableId != null && tableDao.findById(tableId).isEmpty()) {
            warnings.add("Unknown table " + tableId + "; imported without a table");
            tableId = null;
        }
        Order order = new Order(null, code, Objects.requireNonNullElse(str(input, "customer"), "Walk-in"), tableId,
                orderType(str(input, "orderType")));
        if (input.get("tableIds") != null) {
            List<Integer> ids = new ArrayList<>();
            for (Object raw : list(input, "tableIds")) {
                if (raw == null) throw ApiException.badRequest("Invalid table id");
                int id = requireInt(Map.of("id", raw), "id");
                if (ids.contains(id) || tableDao.findById(id).isEmpty()) throw ApiException.badRequest("Invalid or duplicate table id");
                ids.add(id);
            }
            if (ids.size() > 10) throw ApiException.badRequest("At most 10 tables");
            order.setTableIds(ids);
        }
        order.setPaymentMethod(paymentMethod(Objects.requireNonNullElse(str(input, "paymentMethod"), "cash")));
        order.setNote(str(input, "note"));
        // Bàn quyết định chi nhánh; đơn mang đi hoặc giao hàng tự mang theo chi nhánh của nó.
        order.setBranch(order.getTableId() != null
                ? tableDao.findById(order.getTableId()).map(com.dalatcafe.model.Table::getBranch).orElse(null)
                : branchField(input));
        Instant createdAt = instant(input, "createdAt");
        if (createdAt != null) {
            order.setCreatedAt(createdAt);
        }

        List<Object> lines = list(input, "lines");
        if (lines.isEmpty()) {
            throw ApiException.badRequest("Order " + code + " has no lines");
        }
        for (Object rawLine : lines) {
            Map<String, Object> line = asObject(rawLine, "lines entry");
            int qty = requireInt(line, "qty");
            Double price = num(line, "price");
            if (qty <= 0 || price == null || price < 0) {
                throw ApiException.badRequest("Order " + code + " has a line with an invalid qty or price");
            }
            Integer menuItemId = line.get("menuItemId") == null ? null : requireInt(line, "menuItemId");
            if (menuItemId != null) {
                MenuItem item = menuDao.findById(menuItemId).orElse(null);
                if (item == null) {
                    warnings.add("Unknown menu item " + menuItemId + "; line kept without a menu link");
                    menuItemId = null;
                }
            }
            order.addItem(new OrderItem(menuItemId, requireStr(line, "name"), qty, price, str(line, "variation"), null));
        }
        // Đơn COD đã giữ lượt voucher lúc khách đặt: dùng đúng mức giảm đã giữ, không trừ lượt lần hai.
        vouchers.usageForOrder(code).ifPresent(usage -> {
            order.setVoucherCode(vouchers.findById(usage.voucherId()).map(com.dalatcafe.model.Voucher::getCode).orElse(null));
            order.setDiscountAmount(usage.discountAmount());
        });
        order.recalculateTotals();
        Double total = num(input, "total");
        if (total != null && Math.abs(total - order.getTotal()) > 1) {
            warnings.add("Recorded total " + total + " differs from the recomputed " + order.getTotal());
        }

        order.setPaymentStatus(bool(input, "paid", false) ? PaymentStatus.PAID : PaymentStatus.UNPAID);
        String status = str(input, "status");
        OrderStatus target = status == null ? OrderStatus.PENDING : parseStatus(status);
        if (target == OrderStatus.COMPLETED) {
            // Giữ đúng thời điểm đã ghi lúc offline; nếu không, setStatus sẽ ghi thời điểm đồng bộ.
            Instant completedAt = instant(input, "completedAt");
            if (completedAt != null && completedAt.isBefore(order.getCreatedAt())) {
                // Đồng hồ lệch không được khiến một đơn đã bán bị kẹt trong hàng đợi: vẫn nhập nó,
                // và báo lại điều đó.
                warnings.add("Order " + code + " was completed before it was created; completion time set to the creation time");
                completedAt = order.getCreatedAt();
            }
            order.setCompletedAt(completedAt);
        }
        order.setStatus(target);
        if (order.getStatus() == OrderStatus.COMPLETED && order.getPaymentStatus() != PaymentStatus.PAID) {
            throw ApiException.badRequest("Order " + code + " is completed but not paid");
        }
        if (target == OrderStatus.CANCELLED && order.getPaymentStatus() == PaymentStatus.PAID) {
            order.setPaymentStatus(PaymentStatus.REFUNDED);
        }
        return order;
    }

    private static Instant instant(Map<String, Object> input, String key) {
        String raw = str(input, key);
        if (raw == null) {
            return null;
        }
        try {
            return Instant.parse(raw);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest(key + " must be an ISO-8601 instant");
        }
    }

    /** Đơn được nhập đã thanh toán và còn mở thì xếp khách vào bàn và đưa lên KDS. */
    private void notifyImported(Order order, List<String> warnings) {
        boolean open = order.getStatus() != OrderStatus.COMPLETED && order.getStatus() != OrderStatus.CANCELLED;
        if (!open) {
            return;
        }
        try {
            if (order.getPaymentStatus() == PaymentStatus.PAID) eventSubject.notifyOrderPaid(order);
            else eventSubject.notifyOrderOpened(order);
        } catch (RuntimeException e) {
            LOGGER.log(Level.WARNING, "Imported order observer failed: " + e.getMessage(), e);
            warnings.add("Order event observer failed: " + e.getMessage());
        }
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
        json.put("tableIds", order.getTableIds());
        json.put("branch", order.getBranch());
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
        json.put("voucherCode", order.getVoucherCode());
        json.put("vatAmount", order.getVatAmount());
        json.put("total", order.getTotal());
        json.put("note", order.getNote());
        json.put("createdAt", order.getCreatedAt() == null ? null : order.getCreatedAt().toString());
        json.put("completedAt", order.getCompletedAt() == null ? null : order.getCompletedAt().toString());
        return json;
    }
}
