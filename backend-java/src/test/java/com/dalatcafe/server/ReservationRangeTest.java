package com.dalatcafe.server;

import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.dao.InMemoryMenuDao;
import com.dalatcafe.dao.InMemoryOrderDao;
import com.dalatcafe.dao.InMemoryReservationDao;
import com.dalatcafe.dao.InMemoryTableDao;
import com.dalatcafe.model.Reservation;
import com.dalatcafe.model.ReservationStatus;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import com.dalatcafe.util.Json;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLEncoder;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;

/** Phiếu đặt bàn có giờ kết thúc: API, danh sách bàn trống và tự hủy sau 30 phút. */
class ReservationRangeTest {
    private static final int TABLE_ID = 3;
    private static final LocalDate DAY = LocalDate.now().plusDays(2);

    private final HttpClient client = HttpClient.newHttpClient();
    private InMemoryReservationDao reservations;
    private ReservationHandler handler;
    private ExecutorService executor;
    private HttpServer server;

    @BeforeEach
    void setUp() throws Exception {
        InMemoryDatabase.getInstance().reset();
        SystemConfigManager.getInstance().resetToDefaults();
        reservations = new InMemoryReservationDao();
        InMemoryTableDao tables = new InMemoryTableDao();
        InMemoryOrderDao orders = new InMemoryOrderDao();
        handler = new ReservationHandler(reservations, tables, orders, new InMemoryMenuDao());
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/api/reservations", handler);
        server.createContext("/api/tables", new TableHandler(tables, orders, reservations));
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

    private static Instant at(String time) {
        return DAY.atTime(LocalTime.parse(time)).toInstant(ZoneOffset.ofHours(7));
    }

    private HttpResponse<String> send(String method, String path, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + server.getAddress().getPort() + path));
        if (body == null) {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        } else {
            builder.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
        }
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private HttpResponse<String> book(String start, String end) throws Exception {
        String endField = end == null ? "" : ",\"endTime\":\"" + at(end) + "\"";
        return send("POST", "/api/reservations", "{\"customer\":\"Khach\",\"contact\":\"0901234567\",\"guests\":2,"
                + "\"tableId\":" + TABLE_ID + ",\"dateTime\":\"" + at(start) + "\"" + endField + "}");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(HttpResponse<String> response) {
        return (Map<String, Object>) ((Map<String, Object>) Json.parse(response.body())).get("data");
    }

    private Reservation stored(HttpResponse<String> created) {
        return reservations.findByReservationCode((String) data(created).get("id")).orElseThrow();
    }

    @Test
    void createAcceptsEndTime() throws Exception {
        HttpResponse<String> created = book("18:00", "19:30");
        assertEquals(201, created.statusCode(), created.body());
        assertEquals(at("19:30"), stored(created).getStoredEndTime());
        HttpResponse<String> listed = send("GET", "/api/reservations", null);
        assertTrue(listed.body().contains("\"endTime\":\"" + at("19:30") + "\""), listed.body());
    }

    @Test
    void defaultEndIsClampedToClosing() throws Exception {
        HttpResponse<String> late = book("21:00", null);
        assertEquals(201, late.statusCode(), late.body());
        assertEquals(at("22:00"), stored(late).getStoredEndTime());

        HttpResponse<String> noRoom = book("21:45", null);
        assertEquals(400, noRoom.statusCode(), noRoom.body());
        assertTrue(noRoom.body().contains("ít nhất 30 phút"), noRoom.body());

        HttpResponse<String> normal = book("10:00", null);
        assertEquals(at("12:00"), stored(normal).getStoredEndTime());
    }

    @Test
    void invalidEndTimeIsRejected() throws Exception {
        HttpResponse<String> response = send("POST", "/api/reservations", "{\"customer\":\"Khach\",\"contact\":\"0901234567\","
                + "\"guests\":2,\"tableId\":" + TABLE_ID + ",\"dateTime\":\"" + at("10:00") + "\",\"endTime\":\"later\"}");
        assertEquals(400, response.statusCode());
        assertTrue(response.body().contains("endTime must be an ISO-8601 instant"), response.body());
    }

    @Test
    void updateWithoutEndTimeKeepsLength() throws Exception {
        String code = (String) data(book("18:00", "19:30")).get("id");
        HttpResponse<String> moved = send("PUT", "/api/reservations/" + code, "{\"customer\":\"Khach\",\"contact\":\"0901234567\","
                + "\"guests\":2,\"tableId\":" + TABLE_ID + ",\"dateTime\":\"" + at("19:00") + "\"}");
        assertEquals(200, moved.statusCode(), moved.body());
        assertEquals(at("20:30"), reservations.findByReservationCode(code).orElseThrow().getStoredEndTime());

        HttpResponse<String> explicit = send("PUT", "/api/reservations/" + code, "{\"customer\":\"Khach\",\"contact\":\"0901234567\","
                + "\"guests\":2,\"tableId\":" + TABLE_ID + ",\"dateTime\":\"" + at("19:00") + "\",\"endTime\":\"" + at("19:45") + "\"}");
        assertEquals(200, explicit.statusCode(), explicit.body());
        assertEquals(at("19:45"), reservations.findByReservationCode(code).orElseThrow().getStoredEndTime());
    }

    @Test
    void legacyEveningBookingStaysEditable() throws Exception {
        // Phiếu cũ lúc 20:30 không lưu giờ kết thúc: hai giờ suy ra vượt giờ đóng cửa, nhưng sửa
        // số điện thoại vẫn phải được.
        Reservation legacy = new Reservation(null, null, "Khach cu", "0901234567", at("20:30"), 2);
        legacy.setTableId(TABLE_ID);
        assertTrue(reservations.save(legacy));
        HttpResponse<String> edited = send("PUT", "/api/reservations/" + legacy.getReservationCode(),
                "{\"customer\":\"Khach cu\",\"contact\":\"0909999999\",\"guests\":2,\"tableId\":" + TABLE_ID
                        + ",\"dateTime\":\"" + at("20:30") + "\"}");
        assertEquals(200, edited.statusCode(), edited.body());
        Reservation stored = reservations.findByReservationCode(legacy.getReservationCode()).orElseThrow();
        assertEquals("0909999999", stored.getContact());
        assertEquals(at("22:00"), stored.getStoredEndTime());
    }

    @Test
    void catalogAfterClosingStillAnswers() throws Exception {
        // Tra bàn lúc 22:05 không gửi giờ kết thúc: không được báo lỗi chỉ vì giờ đóng cửa đã qua.
        assertEquals(Boolean.TRUE, availability("22:05", null));
    }

    @Test
    void catalogUsesEndTime() throws Exception {
        assertEquals(201, book("18:00", "19:00").statusCode());
        assertEquals(Boolean.TRUE, availability("19:00", "20:00"));
        assertEquals(Boolean.FALSE, availability("18:30", null));
        assertEquals(Boolean.TRUE, availability("16:00", "18:00"));
        assertEquals(Boolean.FALSE, availability("16:30", null), "default two hours reach into 18:00-19:00");
    }

    @SuppressWarnings("unchecked")
    private Object availability(String start, String end) throws Exception {
        String query = "dateTime=" + URLEncoder.encode(at(start).toString(), StandardCharsets.UTF_8)
                + (end == null ? "" : "&endTime=" + URLEncoder.encode(at(end).toString(), StandardCharsets.UTF_8));
        HttpResponse<String> response = send("GET", "/api/tables/catalog?" + query, null);
        assertEquals(200, response.statusCode(), response.body());
        List<Map<String, Object>> tables = (List<Map<String, Object>>) ((Map<String, Object>) Json.parse(response.body())).get("data");
        return tables.stream().filter(t -> ((Number) t.get("id")).intValue() == TABLE_ID).findFirst().orElseThrow().get("available");
    }

    @Test
    void noShowAfterThirtyMinutes() throws Exception {
        Reservation booking = stored(book("10:00", "11:00"));
        booking.setStatus(ReservationStatus.CONFIRMED);
        reservations.save(booking);
        handler.expireNoShows(at("10:29"));
        assertEquals(ReservationStatus.CONFIRMED, reservations.findById(booking.getId()).orElseThrow().getStatus());
        handler.expireNoShows(at("10:30"));
        assertEquals(ReservationStatus.CANCELLED, reservations.findById(booking.getId()).orElseThrow().getStatus());

        Reservation seated = stored(book("12:00", "13:00"));
        seated.setStatus(ReservationStatus.SEATED);
        reservations.save(seated);
        handler.expireNoShows(at("15:00"));
        assertEquals(ReservationStatus.SEATED, reservations.findById(seated.getId()).orElseThrow().getStatus());
    }
}
