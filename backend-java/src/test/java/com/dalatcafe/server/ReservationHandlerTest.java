package com.dalatcafe.server;

import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.dao.InMemoryOrderDao;
import com.dalatcafe.dao.InMemoryReservationDao;
import com.dalatcafe.dao.InMemoryMenuDao;
import com.dalatcafe.dao.InMemoryTableDao;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.Reservation;
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

/** Concurrent bookings: the chain checks and the save must happen as one step. */
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
        // The first booking has read the table's schedule but not saved yet when the second arrives.
        reservations.pauseNextScan();
        CompletableFuture<HttpResponse<String>> first = book();
        assertTrue(reservations.scanPaused.await(5, TimeUnit.SECONDS));
        HttpResponse<String> second = book().get(10, TimeUnit.SECONDS);

        assertEquals(201, first.get(10, TimeUnit.SECONDS).statusCode());
        assertEquals(400, second.statusCode(), second.body());
        assertTrue(second.body().contains("CHAIN_VALIDATION_FAILED"));
        assertEquals(1, reservations.findAll().stream()
                .filter(r -> r.getTableId() == TABLE_ID && SLOT.equals(r.getDateTime()))
                .count());
    }

    @Test
    void aBookingIsTransferredToPosOnlyOnceUnderConcurrentRequests() throws Exception {
        String code = data(book().get(10, TimeUnit.SECONDS)).get("id").toString();
        // The first transfer has checked that no order exists but not saved it yet.
        orders.pauseNextLookup();
        CompletableFuture<HttpResponse<String>> first = send("POST", "/api/reservations/" + code + "/transfer-pos", null);
        assertTrue(orders.lookupPaused.await(5, TimeUnit.SECONDS));
        HttpResponse<String> second = send("POST", "/api/reservations/" + code + "/transfer-pos", null)
                .get(10, TimeUnit.SECONDS);

        assertEquals(200, first.get(10, TimeUnit.SECONDS).statusCode());
        assertEquals(409, second.statusCode(), second.body());
        assertEquals(1, orders.findAll().stream().filter(o -> code.equals(o.getOrderCode())).count());
    }

    private CompletableFuture<HttpResponse<String>> book() {
        return send("POST", "/api/reservations", "{\"customer\":\"An\",\"contact\":\"0912345678\",\"dateTime\":\""
                + SLOT + "\",\"tableId\":" + TABLE_ID + ",\"guests\":2}");
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

    /** Can hold one schedule read until a booking is saved (or 500 ms pass). */
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

    /** Can hold one order lookup until an order is saved (or 500 ms pass). */
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
