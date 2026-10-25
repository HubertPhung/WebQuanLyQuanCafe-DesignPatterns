package com.dalatcafe.server;

import com.dalatcafe.dao.IMenuDao;
import com.dalatcafe.dao.IOrderDao;
import com.dalatcafe.dao.IReservationDao;
import com.dalatcafe.dao.ITableDao;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderItem;
import com.dalatcafe.model.Reservation;
import com.dalatcafe.model.ReservationStatus;
import com.dalatcafe.model.Table;
import com.dalatcafe.model.TableStatus;
import com.dalatcafe.patterns.adapter.IPosOrderTarget;
import com.dalatcafe.patterns.adapter.ReservationToOrderAdapter;
import com.dalatcafe.patterns.chain.ReservationValidationChainFactory;
import com.dalatcafe.patterns.chain.ReservationValidatorHandler;
import com.dalatcafe.patterns.chain.ValidationResult;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * GET|POST /api/reservations, PATCH /api/reservations/{code}/status và POST
 * /api/reservations/{code}/transfer-pos. Phiếu đặt bàn được Chain of Responsibility kiểm tra (giờ
 * mở cửa, sức chứa, bàn trống) trước khi lưu; phiếu đã nhận bàn trở thành đơn POS thông qua {@link
 * ReservationToOrderAdapter}.
 */
public class ReservationHandler extends ApiHandler {
    private static final String TRANSFER = "transfer-pos";

    private final IReservationDao reservationDao;
    private final ITableDao tableDao;
    private final IOrderDao orderDao;
    private final IMenuDao menuDao;
    private final ReservationValidatorHandler validationChain;

    public ReservationHandler(IReservationDao reservationDao, ITableDao tableDao, IOrderDao orderDao, IMenuDao menuDao) {
        this.reservationDao = Objects.requireNonNull(reservationDao, "Reservation DAO must not be null");
        this.tableDao = Objects.requireNonNull(tableDao, "Table DAO must not be null");
        this.orderDao = Objects.requireNonNull(orderDao, "Order DAO must not be null");
        this.menuDao = Objects.requireNonNull(menuDao, "Menu DAO must not be null");
        this.validationChain = ReservationValidationChainFactory.create(tableDao, reservationDao);
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        expireNoShows(Instant.now());
        List<String> parts = segments(exchange);
        if (parts.size() == 3 && parts.get(2).equals("mine")) {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) throw methodNotAllowed(exchange);
            com.dalatcafe.model.UserAccount user = AuthHandler.currentUser(exchange);
            if (user.getId() == null) throw new ApiException(401, "UNAUTHORIZED", "Sign in to view your reservations");
            sendOk(exchange, 200, reservationDao.findForAccount(user.getId(), user.getEmail()).stream()
                    .map(ReservationHandler::toJson).toList(), null);
            return;
        }
        if (parts.size() == 4 && parts.get(3).equals(TRANSFER)) {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                throw methodNotAllowed(exchange);
            }
            transferToPos(exchange, parts.get(2));
            return;
        }
        if (parts.size() == 4 && parts.get(3).equals("status")) {
            String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
            if (!method.equals("PATCH") && !method.equals("PUT")) {
                throw methodNotAllowed(exchange);
            }
            updateStatus(exchange, parts.get(2));
            return;
        }
        if (parts.size() == 3) {
            String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
            if (!method.equals("PUT") && !method.equals("PATCH")) {
                throw methodNotAllowed(exchange);
            }
            update(exchange, parts.get(2));
            return;
        }
        if (parts.size() != 2) {
            throw ApiException.notFound("Unknown reservation resource");
        }
        switch (exchange.getRequestMethod().toUpperCase(Locale.ROOT)) {
            case "GET":
                String branch = branchFilter(exchange);
                List<Object> data = new ArrayList<>();
                for (Reservation reservation : reservationDao.findAll()) {
                    if (branch == null || branch.equals(reservation.getBranch())) {
                        data.add(toJson(reservation));
                    }
                }
                sendOk(exchange, 200, data, null);
                break;
            case "POST":
                create(exchange);
                break;
            default:
                throw methodNotAllowed(exchange);
        }
    }

    private void create(HttpExchange exchange) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        Reservation reservation = new Reservation();
        reservation.setCustomer(requireStr(body, "customer"));
        reservation.setContact(requireStr(body, "contact"));
        reservation.setEmail(str(body, "email"));
        if (exchange.getAttribute(SimpleAuthFilter.USER_ATTRIBUTE) instanceof com.dalatcafe.model.UserAccount user) {
            reservation.setUserId(user.getId());
            if (reservation.getEmail() == null || reservation.getEmail().isBlank()) reservation.setEmail(user.getEmail());
        }
        reservation.setNote(str(body, "note"));
        reservation.setDateTime(parseDateTime(requireStr(body, "dateTime")));
        reservation.setGuests(requireInt(body, "guests"));
        reservation.setStatus(ReservationStatus.PENDING);
        resolveTable(body, reservation);
        for (Object raw : list(body, "preOrders")) {
            Map<String, Object> line = asObject(raw, "preOrders entry");
            int qty = requireInt(line, "qty");
            if (qty <= 0) {
                throw ApiException.badRequest("preOrders qty must be greater than zero");
            }
            // Form đặt bàn là công khai: tên và giá lấy từ thực đơn, không bao giờ lấy từ client.
            int menuItemId = requireInt(line, "menuItemId");
            MenuItem item = menuDao.findById(menuItemId)
                    .orElseThrow(() -> ApiException.badRequest("Unknown menu item in preOrders: " + menuItemId));
            reservation.addPreOrder(new OrderItem(item.getId(), item.getName(), qty, item.getSellPrice(), null, null));
        }

        // Kiểm tra và lưu là một bước, nếu không hai request có thể cùng chiếm một khung giờ.
        synchronized (this) {
            expireNoShows(Instant.now());
            ValidationResult result = validationChain.validate(reservation);
            if (!result.isValid()) {
                throw new ApiException(400, "CHAIN_VALIDATION_FAILED", result.getErrorMessage());
            }
            if (!reservationDao.save(reservation)) {
                throw new ApiException(500, "INTERNAL_SERVER_ERROR", "Could not save the reservation");
            }
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", reservation.getReservationCode());
        data.put("status", reservation.getStatus().getDescription());
        sendOk(exchange, 201, data, "Reservation received");
    }

    /**
     * Sửa phiếu đang chờ hoặc đã xác nhận: thông tin khách, giờ, số khách và bàn. Mã phiếu, trạng
     * thái và món đặt trước giữ nguyên; toàn bộ chuỗi kiểm tra chạy lại và bỏ qua chính phiếu này.
     */
    private void update(HttpExchange exchange, String code) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        Reservation edited;
        // Cùng khóa với create() và transferToPos(): không phiếu nào khác chiếm được khung giờ
        // trong lúc này.
        synchronized (this) {
            expireNoShows(Instant.now());
            Reservation current = reservationDao.findByReservationCode(code)
                    .orElseThrow(() -> ApiException.notFound("Reservation not found: " + code));
            if (current.getStatus() != ReservationStatus.PENDING && current.getStatus() != ReservationStatus.CONFIRMED) {
                throw new ApiException(409, "RESOURCE_CONFLICT",
                        "Chỉ sửa được phiếu đang chờ hoặc đã xác nhận (" + current.getStatus().getDescription() + ").");
            }
            List<Integer> previousTables = current.getTableIds();
            // Một bản sao: DAO trong bộ nhớ trả về chính đối tượng đã lưu, mà bản sửa bị từ chối
            // thì không được đụng tới nó.
            edited = new Reservation(current.getId(), current.getReservationCode(), current.getCustomer(),
                    current.getContact(), current.getDateTime(), current.getGuests());
            edited.setStatus(current.getStatus());
            edited.setPreOrders(current.getPreOrders());
            edited.setUserId(current.getUserId());
            edited.setCreatedAt(current.getCreatedAt());
            edited.setCustomer(requireStr(body, "customer"));
            edited.setContact(requireStr(body, "contact"));
            edited.setEmail(str(body, "email"));
            edited.setNote(str(body, "note"));
            edited.setDateTime(parseDateTime(requireStr(body, "dateTime")));
            edited.setGuests(requireInt(body, "guests"));
            resolveTable(body, edited);
            ValidationResult result = validationChain.validate(edited);
            if (!result.isValid()) {
                throw new ApiException(400, "CHAIN_VALIDATION_FAILED", result.getErrorMessage());
            }
            if (!reservationDao.save(edited)) {
                throw new ApiException(503, "DATABASE_UNAVAILABLE", "Could not save reservation " + code);
            }
            // Các bàn phiếu không còn dùng được trả lại sơ đồ nếu không còn gì khác giữ chúng.
            Reservation released = new Reservation();
            released.setTableIds(previousTables.stream().filter(id -> !edited.getTableIds().contains(id)).toList());
            releaseReservedTables(released, Instant.now());
        }
        sendOk(exchange, 200, toJson(edited), "Reservation " + code + " updated");
    }

    /**
     * Xác nhận hoặc hủy phiếu. Trạng thái SEATED chỉ đạt được qua transfer-pos, nên đơn và bàn luôn
     * được tạo cùng lúc với nó.
     */
    private void updateStatus(HttpExchange exchange, String code) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        ReservationStatus target = parseStatus(requireStr(body, "status"));
        if (target == ReservationStatus.SEATED) {
            throw ApiException.badRequest("Use POST /api/reservations/" + code + "/transfer-pos to seat a booking");
        }
        Reservation reservation;
        boolean changed;
        // Cùng khóa với transferToPos(): không thể hủy phiếu trong lúc đang xếp khách vào bàn.
        synchronized (this) {
            reservation = reservationDao.findByReservationCode(code)
                    .orElseThrow(() -> ApiException.notFound("Reservation not found: " + code));
            ReservationStatus current = reservation.getStatus();
            changed = current != target;
            if (changed) {
                boolean allowed = switch (target) {
                    case CONFIRMED -> current == ReservationStatus.PENDING;
                    case CANCELLED -> current == ReservationStatus.PENDING || current == ReservationStatus.CONFIRMED;
                    default -> false;
                };
                if (!allowed) {
                    if (current == ReservationStatus.SEATED && target == ReservationStatus.CANCELLED) {
                        throw new ApiException(409, "RESOURCE_CONFLICT",
                                "Phiếu đã nhận bàn và mở đơn POS, không thể hủy phiếu đặt bàn.");
                    }
                    throw new ApiException(409, "RESOURCE_CONFLICT", "Reservation " + code + " cannot go from "
                            + current.getDescription() + " to " + target.getDescription());
                }
                if (reservation.getId() == null || !reservationDao.updateStatus(reservation.getId(), target)) {
                    throw new ApiException(500, "INTERNAL_SERVER_ERROR", "Could not update reservation " + code);
                }
                reservation.setStatus(target);
                if (target == ReservationStatus.CANCELLED) releaseReservedTables(reservation, Instant.now());
            }
        }
        if (!changed) {
            sendOk(exchange, 200, toJson(reservation), "Reservation " + code + " is already " + target.getDescription());
            return;
        }
        sendOk(exchange, 200, toJson(reservation), "Reservation " + code + ": " + target.getDescription());
    }

    /**
     * Chỉ nhả các phiếu đang chờ/đã xác nhận mà khách không đến, không bao giờ nhả phiếu đã nhận
     * bàn.
     */
    public synchronized int expireNoShows(Instant now) {
        int expired = 0;
        int grace = SystemConfigManager.getInstance().getAutoCancelMinutes();
        for (Reservation reservation : reservationDao.findAll()) {
            if (reservation.getId() == null || !reservation.isNoShowAt(now, grace)) continue;
            if (!reservationDao.updateStatus(reservation.getId(), ReservationStatus.CANCELLED)) continue;
            reservation.setStatus(ReservationStatus.CANCELLED);
            expired++;
            releaseReservedTables(reservation, now);
        }
        return expired;
    }

    private void releaseReservedTables(Reservation reservation, Instant now) {
        for (int tableId : reservation.getTableIds()) {
            boolean anotherBooking = reservationDao.findAll().stream().anyMatch(other -> other.getTableIds().contains(tableId)
                    && (other.getStatus() == ReservationStatus.PENDING || other.getStatus() == ReservationStatus.CONFIRMED)
                    && other.getDateTime() != null && other.getDateTime().isBefore(now.plusSeconds(7200)));
            boolean openOrder = orderDao.findByTableId(tableId).stream().anyMatch(order -> order.getStatus() != com.dalatcafe.model.OrderStatus.COMPLETED
                    && order.getStatus() != com.dalatcafe.model.OrderStatus.CANCELLED);
            if (!anotherBooking && !openOrder) tableDao.findById(tableId).filter(table -> table.getStatus() == TableStatus.RESERVED)
                    .ifPresent(table -> tableDao.updateStatus(tableId, TableStatus.AVAILABLE, 0));
        }
    }

    private static ReservationStatus parseStatus(String raw) {
        try {
            return ReservationStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("status must be one of: pending, confirmed, cancelled");
        }
    }

    private void transferToPos(HttpExchange exchange, String code) throws IOException {
        IPosOrderTarget target;
        Order order;
        // Kiểm tra đơn đã có và lưu đơn mới là một bước: mỗi phiếu một đơn.
        synchronized (this) {
            Reservation reservation = reservationDao.findByReservationCode(code)
                    .orElseThrow(() -> ApiException.notFound("Reservation not found: " + code));
            ReservationStatus status = reservation.getStatus();
            if (status == ReservationStatus.SEATED || status == ReservationStatus.CANCELLED) {
                throw new ApiException(409, "RESOURCE_CONFLICT",
                        "Reservation " + code + " cannot be transferred: " + status.getDescription());
            }
            if (reservation.getDateTime() == null || Instant.now().isBefore(reservation.getDateTime())) {
                throw new ApiException(409, "RESERVATION_NOT_DUE",
                        "Chưa đến giờ đặt bàn. Chỉ được mở đơn POS khi đến giờ khách đã đặt.");
            }
            if (orderDao.findByOrderCode(reservation.getReservationCode()).isPresent()) {
                throw new ApiException(409, "RESOURCE_CONFLICT", "An order already exists for reservation " + code);
            }

            target = new ReservationToOrderAdapter(reservation);
            order = target.toPosOrder();
            if (!orderDao.save(order)) {
                throw new ApiException(500, "INTERNAL_SERVER_ERROR", "Could not save the POS order for " + code);
            }
            if (reservation.getId() != null) {
                reservationDao.updateStatus(reservation.getId(), ReservationStatus.SEATED);
            }
            int remaining = reservation.getGuests();
            for (int tableId : reservation.getTableIds()) {
                Table table = tableDao.findById(tableId).orElseThrow(() -> ApiException.notFound("Table not found"));
                int count = Math.min(remaining, table.getSeats());
                remaining -= count;
                tableDao.updateStatus(tableId, TableStatus.OCCUPIED, Math.max(1, count));
            }
        }
        sendOk(exchange, 200, orderJson(order, target.getCustomerIdentifier()), "Reservation " + code + " transferred to POS");
    }

    private static Map<String, Object> orderJson(Order order, String customer) {
        Map<String, Object> json = OrderHandler.toJson(order);
        json.put("customer", customer);
        return json;
    }

    private void resolveTable(Map<String, Object> body, Reservation reservation) {
        if (body.get("tableIds") != null) {
            List<Object> requested = list(body, "tableIds");
            if (requested.isEmpty() || requested.size() > 10) throw ApiException.badRequest("Chọn từ 1 đến 10 bàn.");
            List<Integer> ids = new ArrayList<>();
            List<String> names = new ArrayList<>();
            String branch = null;
            for (Object raw : requested) {
                if (raw == null) throw ApiException.badRequest("Mã bàn không hợp lệ.");
                int id = requireInt(Map.of("id", raw), "id");
                if (id < 1 || ids.contains(id)) throw ApiException.badRequest("Mã bàn không hợp lệ hoặc bị trùng.");
                Table table = tableDao.findById(id).orElseThrow(() -> ApiException.notFound("Table not found: " + id));
                if (branch != null && !branch.equals(table.getBranch())) {
                    throw ApiException.badRequest("Các bàn ghép phải cùng một chi nhánh.");
                }
                branch = table.getBranch();
                ids.add(id);
                names.add(table.getName());
            }
            reservation.setTableIds(ids);
            reservation.setTableName(String.join(", ", names));
            reservation.setBranch(branch);
            requireBranch(body, reservation);
            return;
        }
        if (body.get("tableId") != null) {
            int tableId = requireInt(body, "tableId");
            Table table = tableDao.findById(tableId)
                    .orElseThrow(() -> ApiException.notFound("Table not found: " + tableId));
            reservation.setTableId(table.getId());
            reservation.setTableName(table.getName());
            reservation.setBranch(table.getBranch());
            requireBranch(body, reservation);
            return;
        }
        String name = requireStr(body, "table");
        // Hai chi nhánh đánh số bàn giống nhau, nên tên bàn được tìm trong chi nhánh được yêu cầu.
        String branch = com.dalatcafe.model.Branches.orDefault(branchField(body));
        Table table = tableDao.findAll().stream()
                .filter(t -> branch.equals(t.getBranch()) && name.equalsIgnoreCase(t.getName()))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("Table not found: " + name));
        reservation.setTableId(table.getId());
        reservation.setTableName(table.getName());
        reservation.setBranch(table.getBranch());
    }

    /** Phiếu có ghi chi nhánh thì phải dùng bàn của chi nhánh đó. */
    private static void requireBranch(Map<String, Object> body, Reservation reservation) {
        String requested = branchField(body);
        if (requested != null && !requested.equals(reservation.getBranch())) {
            throw ApiException.badRequest("Bàn đã chọn không thuộc chi nhánh này.");
        }
    }

    private static Instant parseDateTime(String raw) {
        try {
            return Instant.parse(raw);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("dateTime must be an ISO-8601 instant, e.g. 2026-10-15T15:00:00Z");
        }
    }

    static Map<String, Object> toJson(Reservation r) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", r.getReservationCode());
        json.put("customer", r.getCustomer());
        json.put("contact", r.getContact());
        json.put("email", r.getEmail());
        json.put("dateTime", r.getDateTime());
        json.put("table", r.getTableName());
        json.put("tableId", r.getTableId());
        json.put("tableIds", r.getTableIds());
        json.put("branch", r.getBranch());
        json.put("guests", r.getGuests());
        json.put("status", r.getStatus() == null ? null : r.getStatus().getDescription());
        json.put("note", r.getNote());
        List<Object> pre = new ArrayList<>();
        if (r.getPreOrders() != null) {
            for (OrderItem item : r.getPreOrders()) {
                Map<String, Object> line = new LinkedHashMap<>();
                line.put("name", item.getName());
                line.put("qty", item.getQty());
                line.put("price", item.getPrice());
                pre.add(line);
            }
        }
        json.put("preOrders", pre);
        return json;
    }
}
