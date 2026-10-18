package com.dalatcafe.server;

import com.dalatcafe.dao.IMenuDao;
import com.dalatcafe.dao.IOrderDao;
import com.dalatcafe.dao.ITableDao;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderItem;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.PaymentMethod;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.model.Table;
import com.dalatcafe.model.TableStatus;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.time.Duration;
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
 * GET /api/analytics/overview?days=7[&branch=id] (MANAGER+): revenue (total, today, yesterday and per day),
 * payment mix, order counts by status, best sellers, fulfillment time and floor occupancy, computed from the DAOs on each call.
 * Revenue counts paid orders only; refunded or cancelled orders are excluded.
 */
public class AnalyticsHandler extends ApiHandler {
    static final ZoneId STORE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int TOP_ITEMS = 5;
    static final int DEFAULT_DAYS = 7;
    static final int MAX_DAYS = 90;

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
        sendOk(exchange, 200, overview(Instant.now(), days(queryParam(exchange, "days")), branchFilter(exchange)), null);
    }

    private static int days(String raw) {
        if (raw == null) {
            return DEFAULT_DAYS;
        }
        try {
            int days = Integer.parseInt(raw);
            if (days >= 1 && days <= MAX_DAYS) {
                return days;
            }
        } catch (NumberFormatException ignored) {
            // Falls through to the error below.
        }
        throw ApiException.badRequest("days must be a whole number between 1 and " + MAX_DAYS);
    }

    Map<String, Object> overview(Instant now, int days) {
        return overview(now, days, null);
    }

    /** {@code branch} limits orders and tables to one branch; null covers the whole shop. */
    Map<String, Object> overview(Instant now, int days, String branch) {
        LocalDate today = now.atZone(STORE_ZONE).toLocalDate();
        LocalDate yesterday = today.minusDays(1);
        LocalDate firstDay = today.minusDays(days - 1L);
        List<Order> orders = orderDao.findAll().stream()
                .filter(order -> branch == null || branch.equals(order.getBranch()))
                .toList();
        Map<LocalDate, double[]> perDay = new LinkedHashMap<>();
        for (LocalDate day = firstDay; !day.isAfter(today); day = day.plusDays(1)) {
            perDay.put(day, new double[2]);
        }
        Map<PaymentMethod, Double> paymentMix = new EnumMap<>(PaymentMethod.class);
        for (PaymentMethod method : PaymentMethod.values()) {
            paymentMix.put(method, 0.0);
        }
        double revenueYesterday = 0;
        int ordersToday = 0;
        int ordersYesterday = 0;
        List<Order> completedToday = new ArrayList<>();
        List<Order> completedYesterday = new ArrayList<>();

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
            LocalDate created = order.getCreatedAt() == null ? null : order.getCreatedAt().atZone(STORE_ZONE).toLocalDate();
            if (today.equals(created)) {
                ordersToday++;
                if (order.getCompletedAt() != null) {
                    completedToday.add(order);
                }
            } else if (yesterday.equals(created)) {
                ordersYesterday++;
                if (order.getCompletedAt() != null) {
                    completedYesterday.add(order);
                }
            }
            if (order.getPaymentStatus() != PaymentStatus.PAID || order.getStatus() == OrderStatus.CANCELLED) {
                continue;
            }
            paidOrders++;
            revenue += order.getTotal();
            if (today.equals(created)) {
                paidToday++;
                revenueToday += order.getTotal();
            } else if (yesterday.equals(created)) {
                revenueYesterday += order.getTotal();
            }
            double[] day = created == null ? null : perDay.get(created);
            if (day != null) {
                day[0] += order.getTotal();
                day[1]++;
                if (order.getPaymentMethod() != null) {
                    paymentMix.merge(order.getPaymentMethod(), order.getTotal(), Double::sum);
                }
                // Best sellers cover the same window as the chart.
                for (OrderItem item : order.getItems()) {
                    double[] totals = items.computeIfAbsent(item.getName(), name -> new double[2]);
                    totals[0] += item.getQty();
                    totals[1] += item.getLineTotal();
                }
            }
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("totalRevenue", revenue);
        data.put("paidOrders", paidOrders);
        data.put("averageOrderValue", paidOrders == 0 ? 0 : revenue / paidOrders);
        data.put("revenueToday", revenueToday);
        data.put("paidOrdersToday", paidToday);
        data.put("revenueYesterday", revenueYesterday);
        data.put("ordersToday", ordersToday);
        data.put("ordersYesterday", ordersYesterday);
        data.put("fulfillmentMinutesToday", fulfillmentMinutes(completedToday));
        data.put("fulfillmentMinutesYesterday", fulfillmentMinutes(completedYesterday));
        data.put("days", days);
        List<Object> series = new ArrayList<>();
        perDay.forEach((day, totals) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", day.toString());
            row.put("revenue", totals[0]);
            row.put("orders", (int) totals[1]);
            series.add(row);
        });
        data.put("revenueByDay", series);
        Map<String, Object> mix = new LinkedHashMap<>();
        paymentMix.forEach((method, total) -> mix.put(method.name().toLowerCase(Locale.ROOT), total));
        data.put("paymentMix", mix);
        Map<String, Object> statusCounts = new LinkedHashMap<>();
        byStatus.forEach((status, count) -> statusCounts.put(status.name().toLowerCase(Locale.ROOT), count));
        data.put("ordersByStatus", statusCounts);
        data.put("topItems", topItems(items));
        data.put("tables", tables(branch));
        return data;
    }

    /** Average minutes from creation to completion, one decimal; 0 when nothing finished. */
    private static double fulfillmentMinutes(List<Order> completed) {
        if (completed.isEmpty()) {
            return 0;
        }
        double minutes = completed.stream()
                .mapToDouble(order -> Duration.between(order.getCreatedAt(), order.getCompletedAt()).toSeconds() / 60.0)
                .average()
                .orElse(0);
        return Math.round(minutes * 10) / 10.0;
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

    private Map<String, Object> tables(String branch) {
        Map<TableStatus, Integer> counts = new EnumMap<>(TableStatus.class);
        for (TableStatus status : TableStatus.values()) {
            counts.put(status, 0);
        }
        List<Table> all = tableDao.findAll().stream()
                .filter(table -> branch == null || branch.equals(table.getBranch()))
                .toList();
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
