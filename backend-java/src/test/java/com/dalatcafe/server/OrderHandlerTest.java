package com.dalatcafe.server;

import com.dalatcafe.dao.InMemoryCustomerDao;
import com.dalatcafe.dao.InMemoryMenuDao;
import com.dalatcafe.dao.InMemoryOrderDao;
import com.dalatcafe.dao.InMemoryTableDao;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderItem;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.OrderType;
import com.dalatcafe.model.PaymentStatus;
import com.dalatcafe.model.TableStatus;
import com.dalatcafe.patterns.observer.IOrderObserver;
import com.dalatcafe.patterns.observer.OrderEventSubject;
import com.dalatcafe.patterns.observer.TableStatusSyncObserver;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

/** Order lifecycle against a DAO that hands out copies, as the JDBC DAO does. */
class OrderHandlerTest {
    private static final String CODE = "AC-RACE-01";

    private final HttpClient client = HttpClient.newHttpClient();
    private SnapshotOrderDao orders;
    private InMemoryTableDao tables;
    private OrderEventSubject events;
    private ExecutorService executor;
    private HttpServer server;

    @BeforeEach
    void setUp() throws IOException {
        orders = new SnapshotOrderDao();
        Order order = new Order(null, CODE, "Walk-in", null, OrderType.PICKUP);
        order.addItem(new OrderItem("Latte", 1, 50_000));
        order.recalculateTotals();
        orders.save(order);

        server = HttpServer.create(new InetSocketAddress(0), 0);
        tables = new InMemoryTableDao();
        events = new OrderEventSubject();
        server.createContext("/api/orders", new OrderHandler(orders, new InMemoryMenuDao(), tables,
                new InMemoryCustomerDao(), events, () -> true));
        executor = Executors.newFixedThreadPool(4);
        server.setExecutor(executor);
        server.start();
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
        executor.shutdownNow();
    }

    @Test
    void cancellingWhileACashierPaysNeverLeavesTheChargedOrderUnpaid() throws Exception {
        // The cancel reads the unpaid order, then the payment arrives before it writes back.
        orders.pauseNextLookup();
        CompletableFuture<HttpResponse<String>> cancel =
                send("PATCH", "/api/orders/" + CODE + "/status", "{\"status\":\"cancelled\"}");
        assertTrue(orders.lookupPaused.await(5, TimeUnit.SECONDS));
        HttpResponse<String> pay = send("POST", "/api/orders/" + CODE + "/pay", "{\"paymentMethod\":\"cash\"}")
                .get(10, TimeUnit.SECONDS);

        assertEquals(200, cancel.get(10, TimeUnit.SECONDS).statusCode());
        // The payment waits for the cancel, then finds the order closed and takes no money.
        assertEquals(409, pay.statusCode(), pay.body());
        Order stored = orders.findByOrderCode(CODE).orElseThrow();
        assertEquals(OrderStatus.CANCELLED, stored.getStatus());
        assertEquals(PaymentStatus.UNPAID, stored.getPaymentStatus());
    }

    @Test
    void offlineCompletedOrdersKeepTheTimeTheyWereCompleted() throws Exception {
        String batch = "{\"orders\":["
                + offlineOrder("AC-0911-OFF", "\"completed\",\"completedAt\":\"2026-10-17T02:12:00Z\"") + ","
                + offlineOrder("AC-0912-OFF", "\"pending\",\"completedAt\":\"2026-10-17T02:12:00Z\"") + ","
                + offlineOrder("AC-0913-OFF", "\"completed\",\"completedAt\":\"2026-10-17T01:59:00Z\"") + ","
                + offlineOrder("AC-0914-OFF", "\"completed\",\"completedAt\":\"yesterday\"") + "]}";

        HttpResponse<String> sync = send("POST", "/api/orders/sync", batch).get(10, TimeUnit.SECONDS);

        assertEquals(200, sync.statusCode(), sync.body());
        assertTrue(sync.body().contains("\"created\":3"), sync.body());
        // Fulfillment time in analytics is completedAt - createdAt: the sync time would inflate it.
        assertEquals("2026-10-17T02:12:00Z", orders.findByOrderCode("AC-0911-OFF").orElseThrow().getCompletedAt().toString());
        assertNull(orders.findByOrderCode("AC-0912-OFF").orElseThrow().getCompletedAt(), "an open order is not completed");
        // A completion time before the creation time is clamped to the creation time, with a warning.
        assertEquals("2026-10-17T02:00:00Z", orders.findByOrderCode("AC-0913-OFF").orElseThrow().getCompletedAt().toString());
        assertTrue(sync.body().contains("completed before it was created"), sync.body());
        assertTrue(orders.findByOrderCode("AC-0914-OFF").isEmpty(), "not an ISO-8601 instant");
    }

    private static String offlineOrder(String code, String statusAndCompletedAt) {
        return "{\"orderCode\":\"" + code + "\",\"orderType\":\"pickup\",\"paymentMethod\":\"cash\",\"paid\":true,"
                + "\"createdAt\":\"2026-10-17T02:00:00Z\",\"lines\":[{\"name\":\"Tra\",\"qty\":1,\"price\":20000}],"
                + "\"status\":" + statusAndCompletedAt + "}";
    }

    @Test
    void cancellingAPaidOrderRefundsIt() throws Exception {
        assertEquals(200, send("POST", "/api/orders/" + CODE + "/pay", "{\"paymentMethod\":\"cash\"}")
                .get(10, TimeUnit.SECONDS).statusCode());
        HttpResponse<String> cancel = send("PATCH", "/api/orders/" + CODE + "/status", "{\"status\":\"cancelled\"}")
                .get(10, TimeUnit.SECONDS);
        assertEquals(200, cancel.statusCode());
        assertTrue(cancel.body().contains("\"paymentStatus\":\"refunded\""), cancel.body());
        assertEquals(PaymentStatus.REFUNDED, orders.findByOrderCode(CODE).orElseThrow().getPaymentStatus());
    }

    @Test
    void cancellationReleasesAllGroupedTablesExceptThoseUsedByAnotherTicket() throws Exception {
        var groupedTables = tables.findAll().stream().limit(2).toList();
        var ids = groupedTables.stream().map(com.dalatcafe.model.Table::getId).toList();
        for (int id : ids) tables.updateStatus(id, TableStatus.OCCUPIED, 2);
        Order grouped = orders.findByOrderCode(CODE).orElseThrow();
        grouped.setTableIds(ids);
        orders.save(grouped);
        Order other = new Order(null, "KDS-OTHER", "Other guest", ids.get(0), OrderType.DINE_IN);
        orders.save(other);
        events.attach(new TableStatusSyncObserver(tables, orders));

        HttpResponse<String> cancelled = send("PATCH", "/api/orders/" + CODE + "/status", "{\"status\":\"cancelled\"}")
                .get(10, TimeUnit.SECONDS);
        assertEquals(200, cancelled.statusCode(), cancelled.body());
        assertEquals(TableStatus.OCCUPIED, tables.findById(ids.get(0)).orElseThrow().getStatus());
        assertEquals(TableStatus.CLEANING, tables.findById(ids.get(1)).orElseThrow().getStatus());
        assertEquals(0, tables.findById(ids.get(1)).orElseThrow().getGuestCount());
        assertEquals(PaymentStatus.UNPAID, orders.findByOrderCode(CODE).orElseThrow().getPaymentStatus());
        assertEquals(409, send("POST", "/api/orders/" + CODE + "/pay", "{\"paymentMethod\":\"cash\"}").get(10, TimeUnit.SECONDS).statusCode());
        assertEquals(409, send("PATCH", "/api/orders/" + CODE + "/status", "{\"status\":\"brewing\"}").get(10, TimeUnit.SECONDS).statusCode());
        assertEquals(200, send("PATCH", "/api/orders/" + CODE + "/status", "{\"status\":\"cancelled\"}").get(10, TimeUnit.SECONDS).statusCode());
    }

    @Test
    void importingCancelledPaidTicketPreservesRefundAndDoesNotOpenKitchenTicket() throws Exception {
        var broadcasts = new java.util.concurrent.atomic.AtomicInteger();
        events.attach(IOrderObserver.whenPaid(order -> broadcasts.incrementAndGet()));
        var response = send("POST", "/api/orders/sync", "{\"orders\":[" + offlineOrder("KDS-CANCELLED", "\"cancelled\"") + "]}")
                .get(10, TimeUnit.SECONDS);
        assertEquals(200, response.statusCode(), response.body());
        Order stored = orders.findByOrderCode("KDS-CANCELLED").orElseThrow();
        assertEquals(OrderStatus.CANCELLED, stored.getStatus());
        assertEquals(PaymentStatus.REFUNDED, stored.getPaymentStatus());
        assertEquals(0, broadcasts.get());
    }

    @Test
    void completingWhileThePaidEventRunsStillLeavesTheTableForCleaning() throws Exception {
        int tableId = tables.findAll().get(0).getId();
        tables.updateStatus(tableId, TableStatus.AVAILABLE, 0);
        Order dineIn = new Order(null, "AC-RACE-02", "Walk-in", tableId, OrderType.DINE_IN);
        dineIn.addItem(new OrderItem("Latte", 1, 50_000));
        dineIn.recalculateTotals();
        orders.save(dineIn);

        // The paid broadcast stalls until the completed broadcast arrives (or 500 ms pass).
        CountDownLatch paidEventStarted = new CountDownLatch(1);
        CountDownLatch completedEventSent = new CountDownLatch(1);
        events.attach(new IOrderObserver() {
            @Override
            public void onOrderPaid(Order order) {
                paidEventStarted.countDown();
                try {
                    completedEventSent.await(500, TimeUnit.MILLISECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }

            @Override
            public void onOrderCompleted(Order order) {
                completedEventSent.countDown();
            }
        });
        events.attach(new TableStatusSyncObserver(tables));

        CompletableFuture<HttpResponse<String>> pay =
                send("POST", "/api/orders/AC-RACE-02/pay", "{\"paymentMethod\":\"cash\"}");
        assertTrue(paidEventStarted.await(5, TimeUnit.SECONDS));
        HttpResponse<String> complete = send("PATCH", "/api/orders/AC-RACE-02/status", "{\"status\":\"completed\"}")
                .get(10, TimeUnit.SECONDS);

        assertEquals(200, pay.get(10, TimeUnit.SECONDS).statusCode());
        assertEquals(200, complete.statusCode(), complete.body());
        // A late "paid" broadcast must not seat the table again after the order was completed.
        assertEquals(TableStatus.CLEANING, tables.findById(tableId).orElseThrow().getStatus());
    }

    private CompletableFuture<HttpResponse<String>> send(String method, String path, String body) {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + server.getAddress().getPort() + path))
                .method(method, HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .header("Content-Type", "application/json")
                .build();
        return client.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    /** Stores and returns copies, and can hold one lookup until a payment is saved (or 500 ms pass). */
    private static final class SnapshotOrderDao extends InMemoryOrderDao {
        final CountDownLatch lookupPaused = new CountDownLatch(1);
        private final CountDownLatch paymentSaved = new CountDownLatch(1);
        private final AtomicBoolean pauseNext = new AtomicBoolean();
        private final Map<String, Order> rows = new ConcurrentHashMap<>();

        void pauseNextLookup() {
            pauseNext.set(true);
        }

        @Override
        public Optional<Order> findByOrderCode(String orderCode) {
            Optional<Order> found = Optional.ofNullable(rows.get(orderCode)).map(SnapshotOrderDao::copy);
            if (pauseNext.compareAndSet(true, false)) {
                lookupPaused.countDown();
                try {
                    paymentSaved.await(500, TimeUnit.MILLISECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            return found;
        }

        @Override
        public boolean save(Order order) {
            rows.put(order.getOrderCode(), copy(order));
            if (order.getPaymentStatus() == PaymentStatus.PAID) {
                paymentSaved.countDown();
            }
            return true;
        }

        @Override
        public java.util.List<Order> findByTableId(int tableId) {
            return rows.values().stream().filter(order -> order.getTableIds().contains(tableId))
                    .map(SnapshotOrderDao::copy).toList();
        }

        private static Order copy(Order source) {
            Order copy = new Order(source.getId(), source.getOrderCode(), source.getCustomer(),
                    source.getTableId(), source.getOrderType());
            copy.setTableIds(source.getTableIds());
            copy.setItems(new ArrayList<>(source.getItems()));
            copy.setPaymentMethod(source.getPaymentMethod());
            copy.setPaymentStatus(source.getPaymentStatus());
            copy.setCompletedAt(source.getCompletedAt());
            copy.setStatus(source.getStatus());
            copy.setCreatedAt(source.getCreatedAt());
            copy.recalculateTotals();
            return copy;
        }
    }
}
