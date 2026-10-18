package com.dalatcafe.server;

import com.dalatcafe.patterns.singleton.SystemConfigManager;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * GET /api/config (STAFF+) and PUT|PATCH /api/config (ADMIN): the store settings held by the
 * {@link SystemConfigManager} Singleton. Only settings the code reads can be changed: store
 * details, opening hours and guest limit (reservation chain), loyalty earn and redeem rates.
 * Changes live in memory and are reset when the server restarts.
 */
public class ConfigHandler extends ApiHandler {
    private static final int MAX_TEXT = 120;

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        List<String> parts = segments(exchange);
        if (parts.size() != 2) {
            throw ApiException.notFound("Unknown config resource");
        }
        switch (exchange.getRequestMethod().toUpperCase(Locale.ROOT)) {
            case "GET":
                sendOk(exchange, 200, toJson(SystemConfigManager.getInstance()), null);
                break;
            case "PUT":
            case "PATCH":
                update(exchange);
                break;
            default:
                throw methodNotAllowed(exchange);
        }
    }

    private void update(HttpExchange exchange) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        SystemConfigManager config = SystemConfigManager.getInstance();
        Map<String, Object> saved;
        // Read, check and write under one lock: two partial updates (say, one moving the opening
        // time and one the closing time) must not each pass against the other's old value.
        synchronized (config) {
            // Validate everything first so a bad field never leaves the settings half-applied.
            String storeName = text(body, "storeName", config.getStoreName());
            String storeAddress = text(body, "storeAddress", config.getStoreAddress());
            String storePhone = text(body, "storePhone", config.getStorePhone());
            LocalTime opening = time(body, "openingTime", config.getOpeningTime());
            LocalTime closing = time(body, "closingTime", config.getClosingTime());
            if (!opening.isBefore(closing)) {
                throw ApiException.badRequest("openingTime must be before closingTime");
            }
            int maxGuests = whole(body, "maxReservationGuests", config.getMaxReservationGuests(), 1, 100);
            int earnRate = whole(body, "loyaltyRateVndPerPoint", config.getLoyaltyRateVndPerPoint(), 1_000, 1_000_000);
            int redeemValue = whole(body, "pointRedeemValueVnd", config.getPointRedeemValueVnd(), 0, 100_000);

            config.setStoreName(storeName);
            config.setStoreAddress(storeAddress);
            config.setStorePhone(storePhone);
            config.setOpeningTime(opening);
            config.setClosingTime(closing);
            config.setMaxReservationGuests(maxGuests);
            config.setLoyaltyRateVndPerPoint(earnRate);
            config.setPointRedeemValueVnd(redeemValue);
            saved = toJson(config);
        }
        sendOk(exchange, 200, saved, "Settings updated");
    }

    private static String text(Map<String, Object> body, String key, String current) {
        if (!body.containsKey(key)) {
            return current;
        }
        String value = str(body, key);
        if (value == null || value.length() > MAX_TEXT) {
            throw ApiException.badRequest("Field '" + key + "' must be 1 to " + MAX_TEXT + " characters");
        }
        return value;
    }

    private static LocalTime time(Map<String, Object> body, String key, LocalTime current) {
        if (!body.containsKey(key)) {
            return current;
        }
        String raw = str(body, key);
        try {
            return LocalTime.parse(raw == null ? "" : raw);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("Field '" + key + "' must be a time such as 07:00");
        }
    }

    private static int whole(Map<String, Object> body, String key, int current, int min, int max) {
        if (!body.containsKey(key)) {
            return current;
        }
        Double value = num(body, key);
        if (value == null || value != Math.floor(value) || value < min || value > max) {
            throw ApiException.badRequest("Field '" + key + "' must be a whole number from " + min + " to " + max);
        }
        return value.intValue();
    }

    static Map<String, Object> toJson(SystemConfigManager config) {
        synchronized (config) {
            return snapshot(config);
        }
    }

    private static Map<String, Object> snapshot(SystemConfigManager config) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("storeName", config.getStoreName());
        json.put("storeAddress", config.getStoreAddress());
        json.put("storePhone", config.getStorePhone());
        json.put("openingTime", config.getOpeningTime().toString());
        json.put("closingTime", config.getClosingTime().toString());
        json.put("maxReservationGuests", config.getMaxReservationGuests());
        json.put("loyaltyRateVndPerPoint", config.getLoyaltyRateVndPerPoint());
        json.put("pointRedeemValueVnd", config.getPointRedeemValueVnd());
        // Shown for reference only: orders use Order.DEFAULT_VAT_RATE and nothing auto-cancels yet.
        json.put("vatRate", config.getVatRate());
        json.put("autoCancelMinutes", config.getAutoCancelMinutes());
        return json;
    }
}
