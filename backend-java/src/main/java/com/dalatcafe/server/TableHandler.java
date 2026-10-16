package com.dalatcafe.server;

import com.dalatcafe.dao.ITableDao;
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

    public TableHandler(ITableDao tableDao) {
        this.tableDao = Objects.requireNonNull(tableDao, "Table DAO must not be null");
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        List<String> parts = segments(exchange);

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
        json.put("status", table.getStatus() == null ? null : table.getStatus().name().toLowerCase(Locale.ROOT));
        json.put("guestCount", table.getGuestCount());
        json.put("occupiedSince", table.getOccupiedSince());
        return json;
    }
}
