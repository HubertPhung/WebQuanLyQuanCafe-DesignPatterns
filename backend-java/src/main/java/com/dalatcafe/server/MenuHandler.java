package com.dalatcafe.server;

import com.dalatcafe.dao.IMenuDao;
import com.dalatcafe.model.MenuItem;
import com.dalatcafe.model.Variation;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * GET /api/menu: the menu and inventory catalog from IMenuDao.
 */
public class MenuHandler extends ApiHandler {
    private final IMenuDao menuDao;

    public MenuHandler(IMenuDao menuDao) {
        this.menuDao = Objects.requireNonNull(menuDao, "Menu DAO must not be null");
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            throw methodNotAllowed(exchange);
        }
        if (segments(exchange).size() != 2) {
            throw ApiException.notFound("Unknown menu resource");
        }
        List<Object> data = new ArrayList<>();
        for (MenuItem item : menuDao.findAll()) {
            data.add(toJson(item));
        }
        sendOk(exchange, 200, data, null);
    }

    static Map<String, Object> toJson(MenuItem item) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", item.getId());
        json.put("name", item.getName());
        json.put("category", item.getCategory());
        json.put("kind", item.getKind());
        json.put("stockQty", item.getStockQty());
        json.put("unit", item.getUnit());
        json.put("lowStockThreshold", item.getLowStockThreshold());
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
