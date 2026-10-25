package com.dalatcafe.server;

import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.dao.InMemoryOrderDao;
import com.dalatcafe.dao.InMemoryReservationDao;
import com.dalatcafe.dao.InMemoryMenuDao;
import com.dalatcafe.dao.InMemoryTableDao;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.Reservation;
import com.dalatcafe.model.ReservationStatus;
import com.dalatcafe.model.TableStatus;
import com.dalatcafe.util.Json;
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
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

/** Đặt bàn đồng thời: kiểm tra chuỗi và lưu phải diễn ra trong một bước. */
class ReservationHandlerTest {
    private static final int TABLE_ID = 3;
    private static final Instant SLOT = LocalDate.now().plusDays(2).atTime(LocalTime.of(15, 0))
            .toInstant(ZoneOffset.ofHours(7));

    private final HttpClient client = HttpClient.newHttpClient();
    private PausingReservationDao reservations;
    private PausingOrderDao orders;
    private ExecutorService executor;
    private HttpServer server;

    @BeforeEach
    void setUp() throws IOException {
        InMemoryDatabase.getInstance().reset();
        reservations = new PausingReservationDao();
        orders = new PausingOrderDao();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/api/reservations", new ReservationHandler(reservations, new InMemoryTableDao(), orders,
                new InMemoryMenuDao()));
        executor = Executors.newFixedThreadPool(4);
        server.setExecutor(executor);
        server.start();
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
        executor.shutdownNow();
        InMemoryDatabase.getInstance().reset();
    }

    @Test
    void twoBookingsForTheSameSlotCannotBothPassTheChain() throws Exception {
        // Tạm dừng một lần quét trước khi lưu; request nào cũng có thể chiếm khóa đặt bàn trước.
        reservations.pauseNextScan();
        CompletableFuture<HttpResponse<String>> first = book();
        assertTrue(reservations.scanPaused.await(5, TimeUnit.SECONDS));
        HttpResponse<String> second = book().get(10, TimeUnit.SECONDS);

        HttpResponse<String> firstResponse = first.get(10, TimeUnit.SECONDS);
        assertEquals(List.of(201, 400), List.of(firstResponse.statusCode(), second.statusCode())
                .stream().sorted().toList(), firstResponse.body() + " / " + second.body());
        HttpResponse<String> rejected = firstResponse.statusCode() == 400 ? firstResponse : second;
        assertTrue(rejected.body().contains("CHAIN_VALIDATION_FAILED"), rejected.body());
        assertEquals(1, reservations.findAll().stream()
                .filter(r -> r.getTableId() == TABLE_ID && SLOT.equals(r.getDateTime()))
                .count());
    }

    @Test
    void simultaneousGroupedBookingsCannotShareEvenASecondaryTable() throws Exception {
        reservations.pauseNextScan();
        var first = book(List.of(3, 4), SLOT);
        assertTrue(reservations.scanPaused.await(5, TimeUnit.SECONDS));
        var second = book(List.of(4, 5), SLOT.plusSeconds(30 * 60)).get(10, TimeUnit.SECONDS);
        var firstResponse = first.get(10, TimeUnit.SECONDS);
        assertEquals(List.of(201, 400), List.of(firstResponse.statusCode(), second.statusCode()).stream().sorted().toList());
        assertEquals(1, reservations.findAll().stream().filter(booking -> booking.getTableIds().contains(4)
                && !booking.getDateTime().isBefore(SLOT)).count());
    }

    @Test
    void aBookingIsTransferredToPosOnlyOnceUnderConcurrentRequests() throws Exception {
        String code = data(book().get(10, TimeUnit.SECONDS)).get("id").toString();
        reservations.findByReservationCode(code).orElseThrow().setDateTime(Instant.now());
        // Lượt chuyển đầu đã kiểm tra chưa có đơn nhưng chưa lưu đơn.
        orders.pauseNextLookup();
        CompletableFuture<HttpResponse<String>> first = send("POST", "/api/reservations/" + code + "/transfer-pos", null);
        assertTrue(orders.lookupPaused.await(5, TimeUnit.SECONDS));
        HttpResponse<String> second = send("POST", "/api/reservations/" + code + "/transfer-pos", null)
                .get(10, TimeUnit.SECONDS);

        assertEquals(200, first.get(10, TimeUnit.SECONDS).statusCode());
        assertEquals(409, second.statusCode(), second.body());
        assertEquals(1, orders.findAll().stream().filter(o -> code.equals(o.getOrderCode())).count());
    }

    @Test
    void futureBookingCannotOpenAnOrderOrOccupyItsTable() throws Exception {
        String code = data(book().get(10, TimeUnit.SECONDS)).get("id").toString();
        HttpResponse<String> response = send("POST", "/api/reservations/" + code + "/transfer-pos", null)
                .get(10, TimeUnit.SECONDS);
        assertEquals(409, response.statusCode(), response.body());
        assertTrue(response.body().contains("RESERVATION_NOT_DUE"), response.body());
        assertTrue(orders.findByOrderCode(code).isEmpty());
        assertEquals(ReservationStatus.PENDING, reservations.findByReservationCode(code).orElseThrow().getStatus());
        assertEquals(TableStatus.AVAILABLE, new InMemoryTableDao().findById(TABLE_ID).orElseThrow().getStatus());
    }

    @Test
    void cancellingAConfirmedOnlineBookingReleasesTheTableAndAllowsRebooking() throws Exception {
        String code = data(book().get(10, TimeUnit.SECONDS)).get("id").toString();
        String path = "/api/reservations/" + code + "/status";
        assertEquals(200, send("PATCH", path, "{\"status\":\"confirmed\"}").get(10, TimeUnit.SECONDS).statusCode());
        new InMemoryTableDao().updateStatus(TABLE_ID, TableStatus.RESERVED, 2);
        assertEquals(200, send("PATCH", path, "{\"status\":\"cancelled\"}").get(10, TimeUnit.SECONDS).statusCode());
        assertEquals(ReservationStatus.CANCELLED, reservations.findByReservationCode(code).orElseThrow().getStatus());
        assertEquals(TableStatus.AVAILABLE, new InMemoryTableDao().findById(TABLE_ID).orElseThrow().getStatus());
        assertTrue(orders.findByOrderCode(code).isEmpty());
        assertEquals(201, book().get(10, TimeUnit.SECONDS).statusCode());
    }

    private CompletableFuture<HttpResponse<String>> book() {
        return book(List.of(TABLE_ID), SLOT);
    }

    private CompletableFuture<HttpResponse<String>> book(List<Integer> tableIds, Instant slot) {
        return send("POST", "/api/reservations", "{\"customer\":\"An\",\"contact\":\"0912345678\",\"dateTime\":\""
                + slot + "\",\"tableId\":" + tableIds.get(0) + ",\"tableIds\":" + tableIds + ",\"guests\":2}");
    }

    private CompletableFuture<HttpResponse<String>> send(String method, String path, String body) {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + server.getAddress().getPort() + path))
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .header("Content-Type", "application/json")
                .build();
        return client.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(HttpResponse<String> response) {
        assertEquals(201, response.statusCode(), response.body());
        return (Map<String, Object>) ((Map<String, Object>) Json.parse(response.body())).get("data");
    }

    /** Có thể giữ một lần đọc lịch cho tới khi một phiếu được lưu (hoặc qua 500 ms). */
    private static final class PausingReservationDao extends InMemoryReservationDao {
        final CountDownLatch scanPaused = new CountDownLatch(1);
        private final CountDownLatch saved = new CountDownLatch(1);
        private final AtomicBoolean pauseNext = new AtomicBoolean();

        void pauseNextScan() {
            pauseNext.set(true);
        }

        @Override
        public List<Reservation> findAll() {
            List<Reservation> snapshot = List.copyOf(super.findAll());
            if (pauseNext.compareAndSet(true, false)) {
                scanPaused.countDown();
                await(saved);
            }
            return snapshot;
        }

        @Override
        public boolean save(Reservation reservation) {
            boolean ok = super.save(reservation);
            saved.countDown();
            return ok;
        }
    }

    /** Có thể giữ một lần tra cứu đơn cho tới khi một đơn được lưu (hoặc qua 500 ms). */
    private static final class PausingOrderDao extends InMemoryOrderDao {
        final CountDownLatch lookupPaused = new CountDownLatch(1);
        private final CountDownLatch saved = new CountDownLatch(1);
        private final AtomicBoolean pauseNext = new AtomicBoolean();

        void pauseNextLookup() {
            pauseNext.set(true);
        }

        @Override
        public Optional<Order> findByOrderCode(String orderCode) {
            Optional<Order> found = super.findByOrderCode(orderCode);
            if (pauseNext.compareAndSet(true, false)) {
                lookupPaused.countDown();
                await(saved);
            }
            return found;
        }

        @Override
        public boolean save(Order order) {
            boolean ok = super.save(order);
            saved.countDown();
            return ok;
        }
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(500, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
