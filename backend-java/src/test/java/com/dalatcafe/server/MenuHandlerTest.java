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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Endpoint stock chỉ bật hoặc tắt bán một món; không theo dõi số lượng. */
class MenuHandlerTest {
    private static final int ITEM_ID = 900;

    private final HttpClient client = HttpClient.newHttpClient();
    private InMemoryMenuDao menu;
    private HttpServer server;

    @BeforeEach
    void setUp() throws IOException {
        InMemoryDatabase database = InMemoryDatabase.getInstance();
        database.reset();
        menu = new InMemoryMenuDao(database);
        MenuItem item = new MenuItem(ITEM_ID, "Ca phe sua", "Coffee", 50_000, 20_000);
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
    void switchesAnItemOffAndOnAgain() throws Exception {
        HttpResponse<String> off = patchStock("{\"inStock\":false}");
        assertEquals(200, off.statusCode(), off.body());
        assertFalse(onSale());
        assertFalse(off.body().contains("stockQty"), "quantities are no longer reported");

        HttpResponse<String> on = patchStock("{\"inStock\":true}");
        assertEquals(200, on.statusCode(), on.body());
        assertTrue(onSale());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{}",
            "{\"change\":-3}",
            "{\"stockQty\":4}",
            "{\"inStock\":\"false\"}",
            "{\"inStock\":1}"
    })
    void anythingButAnInStockSwitchIsRefused(String body) throws Exception {
        HttpResponse<String> response = patchStock(body);

        assertEquals(400, response.statusCode(), response.body());
        assertTrue(onSale(), "rejected requests must not switch the item off");
    }

    private HttpResponse<String> patchStock(String body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(
                        URI.create("http://localhost:" + server.getAddress().getPort() + "/api/menu/" + ITEM_ID + "/stock"))
                .header("Content-Type", "application/json")
                .method("PATCH", HttpRequest.BodyPublishers.ofString(body))
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private boolean onSale() {
        return menu.findById(ITEM_ID).orElseThrow().isInStock();
    }
}
