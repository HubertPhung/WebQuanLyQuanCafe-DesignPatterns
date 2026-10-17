package com.dalatcafe.server;

import com.dalatcafe.dao.IMenuDao;
import com.dalatcafe.dao.IOrderDao;
import com.dalatcafe.dao.ITableDao;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderItem;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.model.Table;
import com.dalatcafe.model.TableStatus;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * GET /api/analytics/overview (MANAGER+): revenue, order counts by status, best sellers,
 * low-stock items and floor occupancy, computed from the DAOs on each call.
 * Revenue counts paid orders only; refunded or cancelled orders are excluded.
 */
public class AnalyticsHandler extends ApiHandler {
    static final ZoneId STORE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int TOP_ITEMS = 5;

    private final IOrderDao orderDao;
    private final IMenuDao menuDao;
    private final ITableDao tableDao;

    public AnalyticsHandler(IOrderDao orderDao, IMenuDao menuDao, ITableDao tableDao) {
        this.orderDao = Objects.requireNonNull(orderDao, "Order DAO must not be null");
        this.menuDao = Objects.requireNonNull(menuDao, "Menu DAO must not be null");
        this.tableDao = Objects.requireNonNull(tableDao, "Table DAO must not be null");
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        List<String> parts = segments(exchange);
        if (parts.size() != 3 || !parts.get(2).equals("overview")) {
            throw ApiException.notFound("Unknown analytics resource");
        }
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            throw methodNotAllowed(exchange);
        }
        sendOk(exchange, 200, overview(Instant.now()), null);
    }

    Map<String, Object> overview(Instant now) {
        LocalDate today = now.atZone(STORE_ZONE).toLocalDate();
        List<Order> orders = orderDao.findAll();

        double revenue = 0;
        double revenueToday = 0;
        int paidOrders = 0;
        int paidToday = 0;
        Map<OrderStatus, Integer> byStatus = new EnumMap<>(OrderStatus.class);
        for (OrderStatus status : OrderStatus.values()) {
            byStatus.put(status, 0);
        }
        Map<String, double[]> items = new LinkedHashMap<>();
        for (Order order : orders) {
            if (order.getStatus() != null) {
                byStatus.merge(order.getStatus(), 1, Integer::sum);
            }
            if (order.getPaymentStatus() != PaymentStatus.PAID || order.getStatus() == OrderStatus.CANCELLED) {
                continue;
            }
            paidOrders++;
            revenue += order.getTotal();
            if (order.getCreatedAt() != null && order.getCreatedAt().atZone(STORE_ZONE).toLocalDate().equals(today)) {
                paidToday++;
                revenueToday += order.getTotal();
            }
            for (OrderItem item : order.getItems()) {
                double[] totals = items.computeIfAbsent(item.getName(), name -> new double[2]);
                totals[0] += item.getQty();
                totals[1] += item.getLineTotal();
            }
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("totalRevenue", revenue);
        data.put("paidOrders", paidOrders);
        data.put("averageOrderValue", paidOrders == 0 ? 0 : revenue / paidOrders);
        data.put("revenueToday", revenueToday);
        data.put("paidOrdersToday", paidToday);
        Map<String, Object> statusCounts = new LinkedHashMap<>();
        byStatus.forEach((status, count) -> statusCounts.put(status.name().toLowerCase(Locale.ROOT), count));
        data.put("ordersByStatus", statusCounts);
        data.put("topItems", topItems(items));
        data.put("lowStockItems", lowStock());
        data.put("tables", tables());
        return data;
    }

    private static List<Object> topItems(Map<String, double[]> items) {
        List<Object> top = new ArrayList<>();
        items.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue()[0], a.getValue()[0]))
                .limit(TOP_ITEMS)
                .forEach(entry -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("name", entry.getKey());
                    row.put("qty", (int) entry.getValue()[0]);
                    row.put("revenue", entry.getValue()[1]);
                    top.add(row);
                });
        return top;
    }

    private List<Object> lowStock() {
        List<Object> low = new ArrayList<>();
        for (MenuItem item : menuDao.findLowStockItems()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", item.getId());
            row.put("name", item.getName());
            row.put("stockQty", item.getStockQty());
            row.put("unit", item.getUnit());
            row.put("lowStockThreshold", item.getLowStockThreshold());
            low.add(row);
        }
        return low;
    }

    private Map<String, Object> tables() {
        Map<TableStatus, Integer> counts = new EnumMap<>(TableStatus.class);
        for (TableStatus status : TableStatus.values()) {
            counts.put(status, 0);
        }
        List<Table> all = tableDao.findAll();
        for (Table table : all) {
            if (table.getStatus() != null) {
                counts.merge(table.getStatus(), 1, Integer::sum);
            }
        }
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("total", all.size());
        counts.forEach((status, count) -> json.put(status.name().toLowerCase(Locale.ROOT), count));
        json.put("occupancyRate", all.isEmpty() ? 0 : (double) counts.get(TableStatus.OCCUPIED) / all.size());
        return json;
    }
}
