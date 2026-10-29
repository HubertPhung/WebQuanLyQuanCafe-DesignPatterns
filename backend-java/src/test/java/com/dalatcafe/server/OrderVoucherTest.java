package com.dalatcafe.server;

import com.dalatcafe.dao.InMemoryCustomerDao;
import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.dao.InMemoryMenuDao;
import com.dalatcafe.dao.InMemoryOrderDao;
import com.dalatcafe.dao.InMemoryTableDao;
import com.dalatcafe.dao.InMemoryVoucherDao;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.Voucher;
import com.dalatcafe.model.VoucherType;
import com.dalatcafe.patterns.observer.OrderEventSubject;
import com.dalatcafe.patterns.observer.VoucherReleaseObserver;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;

/** Đơn COD đã giữ lượt voucher được đồng bộ sang với đúng mức giảm, và đơn bị hủy trả lại lượt. */
class OrderVoucherTest {
    private final HttpClient client = HttpClient.newHttpClient();
    private InMemoryVoucherDao vouchers;
    private VoucherService service;
    private InMemoryOrderDao orders;
    private Voucher sale;
    private ExecutorService executor;
    private HttpServer server;

    @BeforeEach
    void setUp() throws Exception {
        InMemoryDatabase.getInstance().reset();
        vouchers = new InMemoryVoucherDao();
        service = new VoucherService(vouchers, Clock.systemUTC());
        sale = new Voucher();
        sale.setCode("SALE10K");
        sale.setType(VoucherType.FIXED);
        sale.setValue(10_000);
        sale.setStartDate(LocalDate.now(Voucher.CAFE_ZONE).minusDays(1));
        sale.setEndDate(LocalDate.now(Voucher.CAFE_ZONE).plusDays(1));
        assertTrue(vouchers.save(sale));

        orders = new InMemoryOrderDao();
        OrderEventSubject events = new OrderEventSubject();
        events.attach(new VoucherReleaseObserver(service), 30);
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/api/orders", new OrderHandler(orders, new InMemoryMenuDao(), new InMemoryTableDao(),
                new InMemoryCustomerDao(), events, service, () -> true));
        executor = Executors.newFixedThreadPool(2);
        server.setExecutor(executor);
        server.start();
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
        executor.shutdownNow();
        InMemoryDatabase.getInstance().reset();
    }

    private HttpResponse<String> send(String method, String path, String body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + server.getAddress().getPort() + path))
                .header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8)).build();
        return client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    /** Tạm tính 50.000, giảm 10.000, VAT 8% trên phần còn lại = 43.200. */
    private HttpResponse<String> sync(String code, String status) throws Exception {
        String body = "{\"orders\":[{\"orderCode\":\"" + code + "\",\"customer\":\"Khach COD\",\"orderType\":\"pickup\","
                + "\"paymentMethod\":\"cash\",\"paid\":false,\"status\":\"" + status + "\",\"total\":43200,"
                + "\"lines\":[{\"name\":\"Bac xiu\",\"qty\":1,\"price\":50000}]}]}";
        return send("POST", "/api/orders/sync", body);
    }

    private int used() {
        return vouchers.findById(sale.getId()).orElseThrow().getUsedCount();
    }

    @Test
    void importAppliesRedeemedVoucher() throws Exception {
        service.redeem("SALE10K", 50_000, null, "WEB-1", true);
        HttpResponse<String> response = sync("WEB-1", "pending");
        assertEquals(200, response.statusCode(), response.body());
        assertFalse(response.body().contains("differs from the recomputed"), response.body());
        Order order = orders.findByOrderCode("WEB-1").orElseThrow();
        assertEquals("SALE10K", order.getVoucherCode());
        assertEquals(10_000, order.getDiscountAmount());
        assertEquals(1, used());
    }

    @Test
    void importingCancelledOrderReleasesVoucher() throws Exception {
        service.redeem("SALE10K", 50_000, null, "WEB-2", true);
        assertEquals(1, used());
        assertEquals(200, sync("WEB-2", "cancelled").statusCode());
        assertEquals(0, used());
    }

    @Test
    void cancellingTwiceReleasesOnce() throws Exception {
        service.redeem("SALE10K", 50_000, null, "WEB-3", true);
        service.redeem("SALE10K", 50_000, null, "WEB-4", true);
        sync("WEB-3", "pending");
        sync("WEB-4", "pending");
        assertEquals(2, used());
        assertEquals(200, send("PATCH", "/api/orders/WEB-3/status", "{\"status\":\"cancelled\"}").statusCode());
        assertEquals(OrderStatus.CANCELLED, orders.findByOrderCode("WEB-3").orElseThrow().getStatus());
        // Hủy lại một đơn đã hủy là thao tác lặp (200, không phát sự kiện), nên không trả lượt lần hai.
        assertEquals(200, send("PATCH", "/api/orders/WEB-3/status", "{\"status\":\"cancelled\"}").statusCode());
        assertEquals(1, used());
    }
}
