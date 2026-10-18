package com.dalatcafe.server;

import com.dalatcafe.dao.ITableDao;
import com.dalatcafe.dao.IOrderDao;
import com.dalatcafe.dao.IReservationDao;
import com.dalatcafe.model.Table;
import com.dalatcafe.model.TableStatus;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * GET /api/tables and PUT|PATCH /api/tables/{id}[/status]: floor plan and table status updates.
 */
public class TableHandler extends ApiHandler {
    private final ITableDao tableDao;
    private final IOrderDao orderDao;
    private final IReservationDao reservationDao;

    public TableHandler(ITableDao tableDao) {
        this(tableDao, null, null);
    }

    public TableHandler(ITableDao tableDao, IOrderDao orderDao, IReservationDao reservationDao) {
        this.tableDao = Objects.requireNonNull(tableDao, "Table DAO must not be null");
        this.orderDao = orderDao;
        this.reservationDao = reservationDao;
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        List<String> parts = segments(exchange);
        if (parts.size() == 3 && parts.get(2).equals("catalog") && method.equals("GET")) {
            List<Object> data = new ArrayList<>();
            for (Table table : tableDao.findAll()) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", table.getId()); item.put("name", table.getName());
                item.put("seats", table.getSeats()); item.put("zone", table.getZone());
                data.add(item);
            }
            sendOk(exchange, 200, data, null);
            return;
        }

        if (parts.size() == 2 && method.equals("POST")) {
            saveDetails(exchange, null);
            return;
        }
        if (parts.size() == 3 && method.equals("DELETE")) {
            int id = parseId(parts.get(2));
            synchronized (tableDao) {
                Table table = tableDao.findById(id).orElseThrow(() -> ApiException.notFound("Table not found"));
                if (table.getStatus() == TableStatus.OCCUPIED || table.getStatus() == TableStatus.RESERVED
                        || (orderDao != null && orderDao.findByTableId(id).stream().anyMatch(order ->
                            order.getStatus() != com.dalatcafe.model.OrderStatus.CANCELLED
                            && (order.getStatus() != com.dalatcafe.model.OrderStatus.COMPLETED
                                || order.getPaymentStatus() == com.dalatcafe.model.PaymentStatus.UNPAID)))
                        || (reservationDao != null && reservationDao.findAll().stream().anyMatch(r -> r.getTableIds().contains(id)
                            && (r.getStatus() == com.dalatcafe.model.ReservationStatus.PENDING
                                || r.getStatus() == com.dalatcafe.model.ReservationStatus.CONFIRMED)))) {
                    throw new ApiException(409, "RESOURCE_CONFLICT", "Bàn còn khách, đơn chưa kết thúc/thanh toán hoặc lịch đặt chưa xử lý. Vui lòng xử lý trước khi xóa.");
                }
                if (!tableDao.archiveById(id)) throw new ApiException(409, "RESOURCE_CONFLICT", "Không thể xóa bàn.");
            }
            sendOk(exchange, 200, null, "Đã xóa bàn");
            return;
        }
        if (parts.size() == 4 && parts.get(3).equals("details") && method.equals("PUT")) {
            saveDetails(exchange, parseId(parts.get(2)));
            return;
        }

        if (parts.size() == 2 && method.equals("GET")) {
            List<Object> data = new ArrayList<>();
            for (Table table : tableDao.findAll()) {
                data.add(toJson(table));
            }
            sendOk(exchange, 200, data, null);
            return;
        }
        boolean idPath = parts.size() == 3 || (parts.size() == 4 && parts.get(3).equals("status"));
        if (idPath && (method.equals("PUT") || method.equals("PATCH"))) {
            updateStatus(exchange, parseId(parts.get(2)));
            return;
        }
        if (parts.size() > 4 || (parts.size() == 4 && !parts.get(3).equals("status"))) {
            throw ApiException.notFound("Unknown table resource");
        }
        throw methodNotAllowed(exchange);
    }

    private void saveDetails(HttpExchange exchange, Integer id) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        String name = requireStr(body, "name");
        String zone = requireStr(body, "zone");
        int seats = requireInt(body, "seats");
        String image = str(body, "imageUrl");
        if (name.length() > 100 || zone.length() > 50 || seats < 1 || seats > 100) {
            throw ApiException.badRequest("Tên tối đa 100 ký tự, khu vực tối đa 50 ký tự, số chỗ từ 1 đến 100.");
        }
        if (image != null && (image.length() > 2048 || !image.matches("https?://[^\\s]+"))) {
            throw ApiException.badRequest("Ảnh phải là đường dẫn http hoặc https hợp lệ.");
        }
        Table table;
        synchronized (tableDao) {
            if (tableDao.findAll().stream().anyMatch(t -> !Objects.equals(t.getId(), id) && name.equalsIgnoreCase(t.getName()))) {
                throw new ApiException(409, "RESOURCE_CONFLICT", "Tên bàn đã tồn tại.");
            }
            if (id == null) {
                int nextId = tableDao.nextId();
                table = new Table(nextId, name, seats, zone);
            } else {
                table = tableDao.findById(id).orElseThrow(() -> ApiException.notFound("Table not found"));
                if (seats < table.getGuestCount()) throw ApiException.badRequest("Số chỗ nhỏ hơn số khách đang ngồi.");
                if (reservationDao != null && reservationDao.findAll().stream().anyMatch(r -> r.getTableIds().contains(id)
                        && (r.getStatus() == com.dalatcafe.model.ReservationStatus.PENDING
                        || r.getStatus() == com.dalatcafe.model.ReservationStatus.CONFIRMED)
                        && r.getGuests() > r.getTableIds().stream().mapToInt(selected -> selected.equals(id) ? seats
                            : tableDao.findById(selected).map(Table::getSeats).orElse(0)).sum())) {
                    throw ApiException.badRequest("Số chỗ nhỏ hơn số khách đã đặt bàn.");
                }
                table.setName(name);
                table.setZone(zone);
                table.setSeats(seats);
            }
            table.setImageUrl(image);
            if (!tableDao.save(table)) throw new ApiException(503, "DATABASE_UNAVAILABLE", "Không thể lưu bàn.");
        }
        sendOk(exchange, id == null ? 201 : 200, toJson(table), "Đã lưu bàn");
    }

    private void updateStatus(HttpExchange exchange, int id) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        TableStatus status = parseStatus(requireStr(body, "status"));
        Table table = tableDao.findById(id)
                .orElseThrow(() -> ApiException.notFound("Table not found: " + id));

        int guests = body.get("guestCount") == null ? table.getGuestCount() : requireInt(body, "guestCount");
        if (guests < 0 || guests > table.getSeats()) {
            throw ApiException.badRequest("guestCount must be between 0 and " + table.getSeats());
        }
        if (status != TableStatus.OCCUPIED) {
            guests = 0;
        }
        if (!tableDao.updateStatus(id, status, guests)) {
            throw new ApiException(409, "RESOURCE_CONFLICT", "Could not update table " + id);
        }
        sendOk(exchange, 200, null, "Table #" + id + " status changed to '" + status.name().toLowerCase(Locale.ROOT) + "'");
    }

    static TableStatus parseStatus(String raw) {
        try {
            return TableStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("status must be one of: available, occupied, reserved, cleaning");
        }
    }

    static Map<String, Object> toJson(Table table) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", table.getId());
        json.put("name", table.getName());
        json.put("seats", table.getSeats());
        json.put("zone", table.getZone());
        json.put("imageUrl", table.getImageUrl());
        json.put("status", table.getStatus() == null ? null : table.getStatus().name().toLowerCase(Locale.ROOT));
        json.put("guestCount", table.getGuestCount());
        json.put("occupiedSince", table.getOccupiedSince());
        return json;
    }
}
