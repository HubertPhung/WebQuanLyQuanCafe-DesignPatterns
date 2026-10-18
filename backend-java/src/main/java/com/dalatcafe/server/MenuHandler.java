package com.dalatcafe.server;

import com.dalatcafe.dao.IMenuDao;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Variation;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * GET /api/menu (public catalog), POST /api/menu (new item, MANAGER+) and
 * PATCH /api/menu/{id}/stock (stock quantity and the in-stock switch, STAFF+).
 */
public class MenuHandler extends ApiHandler {
    private final IMenuDao menuDao;

    public MenuHandler(IMenuDao menuDao) {
        this.menuDao = Objects.requireNonNull(menuDao, "Menu DAO must not be null");
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        List<String> parts = segments(exchange);
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        if (parts.size() == 4 && parts.get(3).equals("stock")) {
            if (!method.equals("PATCH") && !method.equals("PUT")) {
                throw methodNotAllowed(exchange);
            }
            updateStock(exchange, parseId(parts.get(2)));
            return;
        }
        if (parts.size() != 2) {
            throw ApiException.notFound("Unknown menu resource");
        }
        switch (method) {
            case "GET":
                List<Object> data = new ArrayList<>();
                for (MenuItem item : menuDao.findAll()) {
                    data.add(toJson(item));
                }
                sendOk(exchange, 200, data, null);
                break;
            case "POST":
                create(exchange);
                break;
            default:
                throw methodNotAllowed(exchange);
        }
    }

    private void create(HttpExchange exchange) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        String name = requireStr(body, "name");
        boolean duplicate = menuDao.findAll().stream().anyMatch(item -> name.equalsIgnoreCase(item.getName()));
        if (duplicate) {
            throw new ApiException(409, "RESOURCE_CONFLICT", "Menu item already exists: " + name);
        }
        MenuItem item = new MenuItem(null, name, requireStr(body, "category"),
                nonNegative(body, "sellPrice", null), nonNegative(body, "costPrice", 0.0));
        String kind = str(body, "kind");
        if (kind != null) {
            item.setKind(kind);
        }
        String unit = str(body, "unit");
        if (unit != null) {
            item.setUnit(unit);
        }
        item.setRecipe(str(body, "recipe"));
        item.setImageUrl(str(body, "imageUrl"));
        item.setInStock(bool(body, "inStock", true));
        for (Object raw : list(body, "variations")) {
            Map<String, Object> variation = asObject(raw, "variations entry");
            item.addVariation(new Variation(requireStr(variation, "name"), nonNegative(variation, "price", 0.0)));
        }
        if (!menuDao.save(item)) {
            throw new ApiException(500, "INTERNAL_SERVER_ERROR", "Could not save menu item " + name);
        }
        sendOk(exchange, 201, toJson(item), "Menu item created");
    }

    /**
     * Switches an item on or off for sale. Quantities are no longer tracked, so the body is just
     * {@code {"inStock": true|false}}; the path keeps its name for existing clients.
     */
    private void updateStock(HttpExchange exchange, int id) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        menuDao.findById(id).orElseThrow(() -> ApiException.notFound("Menu item not found: " + id));
        if (body.get("inStock") == null) {
            throw ApiException.badRequest("Field 'inStock' is required; stock quantities are not tracked");
        }
        menuDao.toggleInStock(id, bool(body, "inStock", true));
        MenuItem updated = menuDao.findById(id).orElseThrow(() -> ApiException.notFound("Menu item not found: " + id));
        sendOk(exchange, 200, toJson(updated), updated.isInStock() ? "Item is on sale" : "Item is off sale");
    }

    private static double nonNegative(Map<String, Object> body, String key, Double fallback) {
        Double value = num(body, key);
        if (value == null) {
            if (fallback == null) {
                throw ApiException.badRequest("Field '" + key + "' is required");
            }
            return fallback;
        }
        if (value < 0) {
            throw ApiException.badRequest("Field '" + key + "' must not be negative");
        }
        return value;
    }

    static Map<String, Object> toJson(MenuItem item) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", item.getId());
        json.put("name", item.getName());
        json.put("category", item.getCategory());
        json.put("kind", item.getKind());
        json.put("unit", item.getUnit());
        json.put("costPrice", item.getCostPrice());
        json.put("sellPrice", item.getSellPrice());
        json.put("inStock", item.isInStock());
        json.put("recipe", item.getRecipe());
        List<Object> variations = new ArrayList<>();
        if (item.getVariations() != null) {
            for (Variation variation : item.getVariations()) {
                Map<String, Object> v = new LinkedHashMap<>();
                v.put("name", variation.getName());
                v.put("price", variation.getPrice());
                variations.add(v);
            }
        }
        json.put("variations", variations);
        json.put("imageUrl", item.getImageUrl());
        return json;
    }
}
