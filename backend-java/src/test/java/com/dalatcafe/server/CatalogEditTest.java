package com.dalatcafe.server;

import com.dalatcafe.dao.DaoFactory;
import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Reservation;
import com.dalatcafe.model.ReservationStatus;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import com.dalatcafe.util.Json;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Editing and removing menu items, and editing a booking, through the REST API. */
class CatalogEditTest {
    private static final int DRINK_ID = 903;

    private MainServer server;
    private HttpClient client;

    @BeforeEach
    void setUp() throws Exception {
        InMemoryDatabase.getInstance().reset();
        DaoFactory daos = DaoFactory.getInstance();
        daos.getMenuDao().save(new MenuItem(DRINK_ID, "Tra dao", "Tea", 40_000, 12_000));
        server = new MainServer(0, daos, () -> true);
        server.start();
        client = HttpClient.newHttpClient();
    }

    @AfterEach
    void tearDown() {
        server.stop();
        SystemConfigManager.getInstance().resetToDefaults();
    }

    private HttpResponse<String> call(String method, String path, String role, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + server.getPort() + path))
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
        if (role != null) {
            builder.header("X-User-Role", role);
        }
        if (body != null) {
            builder.header("Content-Type", "application/json");
        }
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(HttpResponse<String> response) {
        return (Map<String, Object>) ((Map<String, Object>) Json.parse(response.body())).get("data");
    }

    private static String at(int daysAhead, int hour) {
        return LocalDate.now().plusDays(daysAhead).atTime(LocalTime.of(hour, 0)).toInstant(ZoneOffset.ofHours(7)).toString();
    }

    private static MenuItem drink() {
        return DaoFactory.getInstance().getMenuDao().findById(DRINK_ID).orElseThrow();
    }

    @Test
    void managerEditsAMenuItem() throws Exception {
        String edit = "{\"name\":\"Tra dao cam sa\",\"category\":\"Tea\",\"sellPrice\":45000,\"costPrice\":15000,"
                + "\"unit\":\"ly\",\"recipe\":\"Dao, cam, sa\",\"variations\":[{\"name\":\"It da\",\"price\":0}]}";
        assertEquals(401, call("PUT", "/api/menu/" + DRINK_ID, null, edit).statusCode());
        assertEquals(403, call("PUT", "/api/menu/" + DRINK_ID, "STAFF", edit).statusCode());

        HttpResponse<String> updated = call("PUT", "/api/menu/" + DRINK_ID, "MANAGER", edit);
        assertEquals(200, updated.statusCode(), updated.body());
        assertEquals("Tra dao cam sa", data(updated).get("name"));
        assertEquals(45_000.0, drink().getSellPrice());
        assertEquals(1, drink().getVariations().size());
        assertEquals("Dao, cam, sa", drink().getRecipe());
    }

    @Test
    void editRejectsTakenNamesAndBadPricesWithoutChangingTheItem() throws Exception {
        String taken = DaoFactory.getInstance().getMenuDao().findById(1).orElseThrow().getName();
        assertEquals(409, call("PUT", "/api/menu/" + DRINK_ID, "MANAGER",
                "{\"name\":\"" + taken.toUpperCase() + "\",\"category\":\"Tea\",\"sellPrice\":1}").statusCode());
        assertEquals(400, call("PUT", "/api/menu/" + DRINK_ID, "MANAGER",
                "{\"name\":\"Tra dao\",\"category\":\"Tea\",\"sellPrice\":-1}").statusCode());
        assertEquals(404, call("PUT", "/api/menu/99999", "MANAGER",
                "{\"name\":\"X\",\"category\":\"Tea\",\"sellPrice\":1}").statusCode());
        assertEquals("Tra dao", drink().getName());
        assertEquals(40_000.0, drink().getSellPrice());
        // Keeping its own name is not a conflict.
        assertEquals(200, call("PUT", "/api/menu/" + DRINK_ID, "MANAGER",
                "{\"name\":\"tra dao\",\"category\":\"Tea\",\"sellPrice\":41000}").statusCode());
    }

    @Test
    void managerDeletesAMenuItem() throws Exception {
        assertEquals(403, call("DELETE", "/api/menu/" + DRINK_ID, "STAFF", null).statusCode());
        assertEquals(200, call("DELETE", "/api/menu/" + DRINK_ID, "MANAGER", null).statusCode());
        assertTrue(DaoFactory.getInstance().getMenuDao().findById(DRINK_ID).isEmpty());
        assertEquals(404, call("DELETE", "/api/menu/" + DRINK_ID, "MANAGER", null).statusCode());
        // The on/off switch stays a STAFF action.
        assertEquals(200, call("PATCH", "/api/menu/1/stock", "STAFF", "{\"inStock\":false}").statusCode());
    }

    private String book(int tableId, int guests, String when) throws Exception {
        HttpResponse<String> created = call("POST", "/api/reservations", null, "{\"customer\":\"An\",\"contact\":\"0911000111\","
                + "\"dateTime\":\"" + when + "\",\"tableId\":" + tableId + ",\"guests\":" + guests + "}");
        assertEquals(201, created.statusCode(), created.body());
        return (String) data(created).get("id");
    }

    private Reservation stored(String code) {
        return DaoFactory.getInstance().getReservationDao().findByReservationCode(code).orElseThrow();
    }

    @Test
    void staffEditsABookingAndKeepsItsCodeAndStatus() throws Exception {
        String code = book(3, 2, at(3, 10));
        assertEquals(200, call("PATCH", "/api/reservations/" + code + "/status", "STAFF", "{\"status\":\"confirmed\"}").statusCode());

        String edit = "{\"customer\":\"An Nguyen\",\"contact\":\"0911000222\",\"dateTime\":\"" + at(3, 15)
                + "\",\"tableIds\":[5,6],\"guests\":8,\"note\":\"Sinh nhat\"}";
        assertEquals(401, call("PUT", "/api/reservations/" + code, null, edit).statusCode());
        HttpResponse<String> updated = call("PUT", "/api/reservations/" + code, "STAFF", edit);
        assertEquals(200, updated.statusCode(), updated.body());

        Reservation booking = stored(code);
        assertEquals("An Nguyen", booking.getCustomer());
        assertEquals(List.of(5, 6), booking.getTableIds());
        assertEquals(8, booking.getGuests());
        assertEquals(ReservationStatus.CONFIRMED, booking.getStatus());
        assertEquals("Sinh nhat", booking.getNote());
    }

    @Test
    void refusedEditLeavesTheBookingUntouched() throws Exception {
        String first = book(3, 2, at(3, 10));
        String second = book(4, 2, at(3, 15));

        // Moving onto a table already booked at that time fails the chain.
        HttpResponse<String> clash = call("PUT", "/api/reservations/" + second, "STAFF", "{\"customer\":\"Binh\",\"contact\":\"0911000333\","
                + "\"dateTime\":\"" + at(3, 10) + "\",\"tableId\":3,\"guests\":2}");
        assertEquals(400, clash.statusCode(), clash.body());
        assertEquals(List.of(4), stored(second).getTableIds());
        assertEquals("An", stored(second).getCustomer());

        // Too many guests for the table also fails, and nothing changes.
        assertEquals(400, call("PUT", "/api/reservations/" + first, "STAFF", "{\"customer\":\"An\",\"contact\":\"0911000111\","
                + "\"dateTime\":\"" + at(3, 10) + "\",\"tableId\":3,\"guests\":9}").statusCode());
        assertEquals(2, stored(first).getGuests());

        // Moving within its own slot is fine: the booking does not clash with itself.
        assertEquals(200, call("PUT", "/api/reservations/" + first, "STAFF", "{\"customer\":\"An\",\"contact\":\"0911000111\","
                + "\"dateTime\":\"" + at(3, 11) + "\",\"tableId\":3,\"guests\":3}").statusCode());
    }

    @Test
    void cancelledOrUnknownBookingsCannotBeEdited() throws Exception {
        String code = book(3, 2, at(3, 10));
        assertEquals(200, call("PATCH", "/api/reservations/" + code + "/status", "STAFF", "{\"status\":\"cancelled\"}").statusCode());
        String edit = "{\"customer\":\"An\",\"contact\":\"0911000111\",\"dateTime\":\"" + at(3, 11) + "\",\"tableId\":3,\"guests\":2}";
        assertEquals(409, call("PUT", "/api/reservations/" + code, "STAFF", edit).statusCode());
        assertEquals(404, call("PUT", "/api/reservations/RES-NOPE", "STAFF", edit).statusCode());
    }
}
