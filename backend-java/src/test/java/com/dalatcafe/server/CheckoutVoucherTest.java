package com.dalatcafe.server;

import com.dalatcafe.dao.InMemoryCustomerDao;
import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.dao.InMemoryMenuDao;
import com.dalatcafe.dao.InMemoryOrderDao;
import com.dalatcafe.dao.InMemoryTableDao;
import com.dalatcafe.dao.InMemoryVoucherDao;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.Voucher;
import com.dalatcafe.model.VoucherType;
import com.dalatcafe.patterns.facade.PosCheckoutFacade;
import com.dalatcafe.patterns.observer.OrderEventSubject;
import com.dalatcafe.util.Json;
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
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** Checkout giữ một lượt voucher trước khi thu tiền, ghi mã vào đơn, và trả lượt khi thất bại. */
class CheckoutVoucherTest {
    private static final int DRINK_ID = 911;
    private static final LocalDate TODAY = LocalDate.now(Voucher.CAFE_ZONE);

    private final HttpClient client = HttpClient.newHttpClient();
    private InMemoryVoucherDao vouchers;
    private VoucherService service;
    private InMemoryOrderDao orders;
    private ExecutorService executor;
    private HttpServer server;

    @BeforeEach
    void setUp() throws Exception {
        InMemoryDatabase.getInstance().reset();
        InMemoryMenuDao menu = new InMemoryMenuDao();
        MenuItem drink = new MenuItem(DRINK_ID, "Bac xiu", "Coffee", 45_000, 15_000);
        drink.setInStock(true);
        menu.save(drink);
        vouchers = new InMemoryVoucherDao();
        service = new VoucherService(vouchers, Clock.systemUTC());
        orders = new InMemoryOrderDao();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/api/checkout", new CheckoutHandler(new PosCheckoutFacade(orders, menu, new OrderEventSubject()),
                new InMemoryCustomerDao(), new InMemoryTableDao(), orders, null, service, () -> true));
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

    private Voucher voucher(String code, double amount) {
        Voucher v = new Voucher();
        v.setCode(code);
        v.setType(VoucherType.FIXED);
        v.setValue(amount);
        v.setStartDate(TODAY.minusDays(1));
        v.setEndDate(TODAY.plusDays(1));
        assertTrue(vouchers.save(v));
        return v;
    }

    private int used(Voucher v) {
        return vouchers.findById(v.getId()).orElseThrow().getUsedCount();
    }

    private CompletableFuture<HttpResponse<String>> post(String extra) {
        String body = "{\"paymentMethod\":\"cash\",\"orderType\":\"pickup\",\"lines\":[{\"menuItemId\":" + DRINK_ID
                + ",\"qty\":1}]" + extra + "}";
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + server.getAddress().getPort() + "/api/checkout"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8)).build();
        return client.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private HttpResponse<String> checkout(String extra) throws Exception {
        return post(extra).get(10, TimeUnit.SECONDS);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(HttpResponse<String> response) {
        return (Map<String, Object>) ((Map<String, Object>) Json.parse(response.body())).get("data");
    }

    @Test
    void voucherIsRedeemedAndRecordedOnOrder() throws Exception {
        Voucher v = voucher("SALE10K", 10_000);
        HttpResponse<String> response = checkout(",\"voucherCode\":\"sale10k\"");
        assertEquals(200, response.statusCode(), response.body());
        assertEquals(10_000, ((Number) data(response).get("discountAmount")).doubleValue());
        String code = (String) data(response).get("orderCode");
        Order order = orders.findByOrderCode(code).orElseThrow();
        assertEquals("SALE10K", order.getVoucherCode());
        assertEquals(1, used(v));
        assertEquals(10_000, service.usageForOrder(code).orElseThrow().discountAmount());
    }

    @Test
    void failedCheckoutReturnsTheUse() throws Exception {
        Voucher v = voucher("SALE10K", 10_000);
        // Tiền mặt khách đưa không đủ: thanh toán thất bại sau khi lượt đã được giữ.
        HttpResponse<String> response = checkout(",\"voucherCode\":\"SALE10K\",\"tenderedAmount\":1000");
        assertEquals(400, response.statusCode(), response.body());
        assertEquals(0, used(v));
        assertTrue(vouchers.findUsages(v.getId()).isEmpty());
    }

    @Test
    void soldOutVoucherRejectsCheckout() throws Exception {
        Voucher v = voucher("ONCE", 10_000);
        v.setMaxUses(1);
        vouchers.save(v);
        service.redeem("ONCE", 100_000, null, "ORD-OLD", false);
        int before = orders.findAll().size();
        HttpResponse<String> response = checkout(",\"voucherCode\":\"ONCE\"");
        assertEquals(400, response.statusCode(), response.body());
        assertTrue(response.body().contains("INVALID_VOUCHER"), response.body());
        assertEquals(before, orders.findAll().size());
    }

    @Test
    void belowMinOrderRejectsCheckout() throws Exception {
        Voucher v = voucher("MIN100", 10_000);
        v.setMinOrder(100_000);
        vouchers.save(v);
        HttpResponse<String> response = checkout(",\"voucherCode\":\"MIN100\"");
        assertEquals(400, response.statusCode(), response.body());
        assertTrue(response.body().contains("cần mua thêm"), response.body());
        assertEquals(0, used(v));
    }

    @Test
    void onlineOnlyVoucherNeedsStorefront() throws Exception {
        HttpResponse<String> response = checkout(",\"voucherCode\":\"WELCOME10\",\"userId\":7");
        assertEquals(400, response.statusCode(), response.body());
        assertTrue(response.body().contains("INVALID_VOUCHER"), response.body());
    }

    @Test
    void concurrentCheckoutsRespectMaxUses() throws Exception {
        Voucher v = voucher("ONCE", 10_000);
        v.setMaxUses(1);
        vouchers.save(v);
        List<CompletableFuture<HttpResponse<String>>> both = List.of(post(",\"voucherCode\":\"ONCE\""), post(",\"voucherCode\":\"ONCE\""));
        long ok = 0;
        for (CompletableFuture<HttpResponse<String>> future : both) {
            if (future.get(10, TimeUnit.SECONDS).statusCode() == 200) ok++;
        }
        assertEquals(1, ok);
        assertEquals(1, used(v));
    }
}
