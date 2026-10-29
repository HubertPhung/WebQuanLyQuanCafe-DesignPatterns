package com.dalatcafe.server;

import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.dao.InMemoryVoucherDao;
import com.dalatcafe.model.Voucher;
import com.dalatcafe.model.VoucherType;
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
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

/** Admin sửa hoặc xóa mã đúng lúc một lượt redeem chen vào giữa bước kiểm tra và bước ghi. */
class VoucherRaceTest {
    private static final LocalDate TODAY = LocalDate.now(Voucher.CAFE_ZONE);

    /** Cho một lượt redeem chạy ngay trước lần ghi hoặc xóa kế tiếp, như một request đến cùng lúc. */
    private static final class RacingDao extends InMemoryVoucherDao {
        final AtomicBoolean raceNextWrite = new AtomicBoolean();

        private void race(int id) {
            if (raceNextWrite.getAndSet(false)) redeem(id, null, "ORD-RACE", 10_000);
        }

        @Override
        public boolean save(Voucher voucher) {
            if (voucher.getId() != null) race(voucher.getId());
            return super.save(voucher);
        }

        @Override
        public boolean deleteById(int id) {
            race(id);
            return super.deleteById(id);
        }
    }

    private final HttpClient client = HttpClient.newHttpClient();
    private RacingDao dao;
    private HttpServer server;
    private int id;

    @BeforeEach
    void setUp() throws Exception {
        InMemoryDatabase.getInstance().reset();
        dao = new RacingDao();
        Voucher v = new Voucher();
        v.setCode("SALE1111");
        v.setType(VoucherType.FIXED);
        v.setValue(10_000);
        v.setMaxUses(5);
        v.setStartDate(TODAY.minusDays(1));
        v.setEndDate(TODAY.plusDays(30));
        assertTrue(dao.save(v));
        id = v.getId();
        dao.redeem(id, null, "ORD-1", 10_000);
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/api/vouchers", new VoucherHandler(new VoucherService(dao, Clock.systemUTC()), dao));
        server.start();
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
        InMemoryDatabase.getInstance().reset();
    }

    private HttpResponse<String> send(String method, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + server.getAddress().getPort() + "/api/vouchers/" + id));
        builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    @Test
    void loweringMaxUsesWhileARedeemLandsReportsTheLimit() throws Exception {
        // Kiểm tra trước thấy 1 lượt đã dùng nên maxUses 1 có vẻ hợp lệ; lượt chen vào làm thành 2.
        dao.raceNextWrite.set(true);
        HttpResponse<String> response = send("PUT", "{\"code\":\"SALE1111\",\"type\":\"FIXED\",\"value\":10000,\"maxUses\":1,"
                + "\"startDate\":\"" + TODAY.minusDays(1) + "\",\"endDate\":\"" + TODAY.plusDays(30) + "\"}");
        assertEquals(400, response.statusCode(), response.body());
        assertTrue(response.body().contains("số lượt đã dùng"), response.body());
        Voucher stored = dao.findById(id).orElseThrow();
        assertEquals(5, stored.getMaxUses());
        assertEquals(2, stored.getUsedCount());
    }

    @Test
    @SuppressWarnings("unchecked")
    void deletingWhileARedeemLandsDeactivatesInstead() throws Exception {
        dao.releaseByOrder("ORD-1");
        dao.raceNextWrite.set(true);
        HttpResponse<String> response = send("DELETE", null);
        assertEquals(200, response.statusCode(), response.body());
        Map<String, Object> data = (Map<String, Object>) ((Map<String, Object>) Json.parse(response.body())).get("data");
        assertEquals(Boolean.FALSE, data.get("deleted"));
        assertEquals(Boolean.TRUE, data.get("deactivated"));
        assertFalse(dao.findById(id).orElseThrow().isActive());
        assertTrue(dao.findUsageByOrder("ORD-RACE").isPresent());
    }
}
