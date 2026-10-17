package com.dalatcafe.dao;

import com.dalatcafe.model.OrderItem;
import com.dalatcafe.model.Variation;
import com.dalatcafe.util.Json;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Converts the list-valued model fields to and from the JSONB columns
 * {@code orders.items}, {@code reservations.pre_orders} and {@code menu_items.variations}.
 * A malformed stored value reads back as an empty list instead of failing the whole query.
 */
final class JsonColumns {
    private static final Logger LOGGER = Logger.getLogger(JsonColumns.class.getName());

    private JsonColumns() {
    }

    static String fromItems(List<OrderItem> items) {
        List<Object> json = new ArrayList<>();
        if (items != null) {
            for (OrderItem item : items) {
                Map<String, Object> line = new LinkedHashMap<>();
                line.put("menuItemId", item.getMenuItemId());
                line.put("name", item.getName());
                line.put("qty", item.getQty());
                line.put("price", item.getPrice());
                line.put("variation", item.getVariation());
                line.put("notes", item.getNotes());
                json.add(line);
            }
        }
        return Json.stringify(json);
    }

    static List<OrderItem> toItems(String raw) {
        List<OrderItem> items = new ArrayList<>();
        for (Map<String, Object> line : objects(raw)) {
            Object menuItemId = line.get("menuItemId");
            items.add(new OrderItem(
                    menuItemId instanceof Number number ? number.intValue() : null,
                    (String) line.get("name"),
                    line.get("qty") instanceof Number qty ? qty.intValue() : 1,
                    line.get("price") instanceof Number price ? price.doubleValue() : 0,
                    (String) line.get("variation"),
                    (String) line.get("notes")));
        }
        return items;
    }

    static String fromVariations(List<Variation> variations) {
        List<Object> json = new ArrayList<>();
        if (variations != null) {
            for (Variation variation : variations) {
                Map<String, Object> v = new LinkedHashMap<>();
                v.put("name", variation.getName());
                v.put("price", variation.getPrice());
                json.add(v);
            }
        }
        return Json.stringify(json);
    }

    static List<Variation> toVariations(String raw) {
        List<Variation> variations = new ArrayList<>();
        for (Map<String, Object> v : objects(raw)) {
            variations.add(new Variation((String) v.get("name"),
                    v.get("price") instanceof Number price ? price.doubleValue() : 0));
        }
        return variations;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> objects(String raw) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (raw == null || raw.isBlank()) {
            return result;
        }
        try {
            if (Json.parse(raw) instanceof List<?> list) {
                for (Object entry : list) {
                    if (entry instanceof Map<?, ?> map) {
                        result.add((Map<String, Object>) map);
                    }
                }
            }
        } catch (RuntimeException e) {
            LOGGER.log(Level.WARNING, "Ignoring malformed JSONB value: " + e.getMessage());
        }
        return result;
    }
}
