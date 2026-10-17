package com.dalatcafe.server;

import com.dalatcafe.dao.IOrderDao;
import com.dalatcafe.dao.IReservationDao;
import com.dalatcafe.dao.ITableDao;
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
 * GET|POST /api/reservations and POST /api/reservations/{code}/transfer-pos.
 * A booking is validated by the Chain of Responsibility (operating hours, capacity,
 * table availability) before being stored; a seated booking becomes a POS order through
 * the {@link ReservationToOrderAdapter}.
 */
public class ReservationHandler extends ApiHandler {
    private static final String TRANSFER = "transfer-pos";

    private final IReservationDao reservationDao;
    private final ITableDao tableDao;
    private final IOrderDao orderDao;
    private final ReservationValidatorHandler validationChain;

    public ReservationHandler(IReservationDao reservationDao, ITableDao tableDao, IOrderDao orderDao) {
        this.reservationDao = Objects.requireNonNull(reservationDao, "Reservation DAO must not be null");
        this.tableDao = Objects.requireNonNull(tableDao, "Table DAO must not be null");
        this.orderDao = Objects.requireNonNull(orderDao, "Order DAO must not be null");
        this.validationChain = ReservationValidationChainFactory.create(tableDao, reservationDao);
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        List<String> parts = segments(exchange);
        if (parts.size() == 4 && parts.get(3).equals(TRANSFER)) {
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                throw methodNotAllowed(exchange);
            }
            transferToPos(exchange, parts.get(2));
            return;
        }
        if (parts.size() != 2) {
            throw ApiException.notFound("Unknown reservation resource");
        }
        switch (exchange.getRequestMethod().toUpperCase(Locale.ROOT)) {
            case "GET":
                List<Object> data = new ArrayList<>();
                for (Reservation reservation : reservationDao.findAll()) {
                    data.add(toJson(reservation));
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
        reservation.setNote(str(body, "note"));
        reservation.setDateTime(parseDateTime(requireStr(body, "dateTime")));
        reservation.setGuests(requireInt(body, "guests"));
        reservation.setStatus(ReservationStatus.PENDING);
        resolveTable(body, reservation);
        for (Object raw : list(body, "preOrders")) {
            Map<String, Object> line = asObject(raw, "preOrders entry");
            Double price = num(line, "price");
            if (price == null || price < 0) {
                throw ApiException.badRequest("preOrders price must be a non-negative number");
            }
            int qty = requireInt(line, "qty");
            if (qty <= 0) {
                throw ApiException.badRequest("preOrders qty must be greater than zero");
            }
            reservation.addPreOrder(new OrderItem(requireStr(line, "name"), qty, price));
        }

        ValidationResult result = validationChain.validate(reservation);
        if (!result.isValid()) {
            throw new ApiException(400, "CHAIN_VALIDATION_FAILED", result.getErrorMessage());
        }
        if (!reservationDao.save(reservation)) {
            throw new ApiException(500, "INTERNAL_SERVER_ERROR", "Could not save the reservation");
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", reservation.getReservationCode());
        data.put("status", reservation.getStatus().getDescription());
        sendOk(exchange, 201, data, "Reservation received");
    }

    private void transferToPos(HttpExchange exchange, String code) throws IOException {
        Reservation reservation = reservationDao.findByReservationCode(code)
                .orElseThrow(() -> ApiException.notFound("Reservation not found: " + code));
        ReservationStatus status = reservation.getStatus();
        if (status == ReservationStatus.SEATED || status == ReservationStatus.CANCELLED) {
            throw new ApiException(409, "RESOURCE_CONFLICT",
                    "Reservation " + code + " cannot be transferred: " + status.getDescription());
        }
        if (orderDao.findByOrderCode(reservation.getReservationCode()).isPresent()) {
            throw new ApiException(409, "RESOURCE_CONFLICT", "An order already exists for reservation " + code);
        }

        IPosOrderTarget target = new ReservationToOrderAdapter(reservation);
        Order order = target.toPosOrder();
        if (!orderDao.save(order)) {
            throw new ApiException(500, "INTERNAL_SERVER_ERROR", "Could not save the POS order for " + code);
        }
        if (reservation.getId() != null) {
            reservationDao.updateStatus(reservation.getId(), ReservationStatus.SEATED);
        }
        int tableId = target.getAssignedTableId();
        if (tableId > 0) {
            tableDao.findById(tableId).ifPresent(table ->
                    tableDao.updateStatus(tableId, TableStatus.OCCUPIED, Math.min(reservation.getGuests(), table.getSeats())));
        }
        sendOk(exchange, 200, orderJson(order, target.getCustomerIdentifier()), "Reservation " + code + " transferred to POS");
    }

    private static Map<String, Object> orderJson(Order order, String customer) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("orderCode", order.getOrderCode());
        json.put("customer", customer);
        json.put("tableId", order.getTableId());
        json.put("orderType", order.getOrderType().name().toLowerCase(Locale.ROOT).replace('_', '-'));
        json.put("status", order.getStatus().name().toLowerCase(Locale.ROOT));
        json.put("paymentStatus", order.getPaymentStatus().name().toLowerCase(Locale.ROOT));
        List<Object> items = new ArrayList<>();
        for (OrderItem item : order.getItems()) {
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("name", item.getName());
            line.put("qty", item.getQty());
            line.put("price", item.getPrice());
            items.add(line);
        }
        json.put("items", items);
        json.put("subtotal", order.getSubtotal());
        json.put("vatAmount", order.getVatAmount());
        json.put("total", order.getTotal());
        return json;
    }

    private void resolveTable(Map<String, Object> body, Reservation reservation) {
        if (body.get("tableId") != null) {
            int tableId = requireInt(body, "tableId");
            Table table = tableDao.findById(tableId)
                    .orElseThrow(() -> ApiException.notFound("Table not found: " + tableId));
            reservation.setTableId(table.getId());
            reservation.setTableName(table.getName());
            return;
        }
        String name = requireStr(body, "table");
        Table table = tableDao.findAll().stream()
                .filter(t -> name.equalsIgnoreCase(t.getName()))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("Table not found: " + name));
        reservation.setTableId(table.getId());
        reservation.setTableName(table.getName());
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
