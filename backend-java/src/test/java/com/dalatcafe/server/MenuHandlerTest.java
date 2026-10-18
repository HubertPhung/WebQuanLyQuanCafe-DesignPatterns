package com.dalatcafe.server;

import com.dalatcafe.dao.InMemoryDatabase;
import com.dalatcafe.dao.InMemoryMenuDao;
import com.dalatcafe.model.MenuItem;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Stock changes against a menu DAO where another counter sells right after the handler reads. */
class MenuHandlerTest {
    private static final int ITEM_ID = 900;

    private final HttpClient client = HttpClient.newHttpClient();
    private RacingMenuDao menu;
    private HttpServer server;

    @BeforeEach
    void setUp() throws IOException {
        InMemoryDatabase database = InMemoryDatabase.getInstance();
        database.reset();
        menu = new RacingMenuDao(database);
        MenuItem item = new MenuItem(ITEM_ID, "Ca phe sua", "Coffee", 50_000, 20_000, 10);
        item.setInStock(true);
        menu.save(item);

        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/api/menu", new MenuHandler(menu));
        server.start();
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void writingOffMoreThanIsLeftAfterAConcurrentSaleIsRefused() throws Exception {
        menu.sellNineOnNextLookup();

        HttpResponse<String> response = patchStock("{\"change\":-3}");

        assertEquals(409, response.statusCode(), response.body());
        assertEquals(1.0, stock(), "the one unit left is not written off");
    }

    @Test
    void settingAnAbsoluteQuantityIsNotRefused() throws Exception {
        menu.sellNineOnNextLookup();

        HttpResponse<String> response = patchStock("{\"stockQty\":4}");

        assertEquals(200, response.statusCode(), response.body());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"change\":3,\"inStock\":\"false\"}",
            "{\"change\":-3,\"inStock\":1}",
            "{\"stockQty\":4,\"inStock\":{}}"
    })
    void invalidStockSwitchDoesNotChangeInventory(String body) throws Exception {
        HttpResponse<String> response = patchStock(body);

        assertEquals(400, response.statusCode(), response.body());
        assertEquals(10.0, stock(), "rejected requests must not change stock");
        assertEquals(true, menu.findById(ITEM_ID).orElseThrow().isInStock());
    }

    private HttpResponse<String> patchStock(String body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(
                        URI.create("http://localhost:" + server.getAddress().getPort() + "/api/menu/" + ITEM_ID + "/stock"))
                .header("Content-Type", "application/json")
                .method("PATCH", HttpRequest.BodyPublishers.ofString(body))
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private double stock() {
        return menu.findById(ITEM_ID).orElseThrow().getStockQty();
    }

    /** Hands out a copy, like the JDBC DAO, and can sell 9 units right after one lookup. */
    private static final class RacingMenuDao extends InMemoryMenuDao {
        private final AtomicBoolean sellNine = new AtomicBoolean();

        RacingMenuDao(InMemoryDatabase database) {
            super(database);
        }

        void sellNineOnNextLookup() {
            sellNine.set(true);
        }

        @Override
        public Optional<MenuItem> findById(int id) {
            Optional<MenuItem> live = super.findById(id);
            if (live.isEmpty()) {
                return live;
            }
            MenuItem item = live.get();
            MenuItem copy = new MenuItem(item.getId(), item.getName(), item.getCategory(),
                    item.getSellPrice(), item.getCostPrice(), item.getStockQty());
            copy.setInStock(item.isInStock());
            if (sellNine.getAndSet(false)) {
                super.updateStock(id, -9);
            }
            return Optional.of(copy);
        }
    }
}
