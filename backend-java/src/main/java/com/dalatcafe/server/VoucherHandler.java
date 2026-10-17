package com.dalatcafe.server;

import com.dalatcafe.patterns.strategy.DiscountContext;
import com.dalatcafe.patterns.strategy.IDiscountStrategy;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * POST /api/vouchers/validate: previews a voucher against a subtotal using the same Strategy
 * that checkout applies (see {@link VoucherCatalog}). Answers 200 with {@code valid:false}
 * for an unknown code, so the storefront can show the reason inline.
 */
public class VoucherHandler extends ApiHandler {
    @Override
    protected void route(HttpExchange exchange) throws IOException {
        List<String> parts = segments(exchange);
        if (parts.size() != 3 || !parts.get(2).equals("validate")) {
            throw ApiException.notFound("Unknown voucher resource");
        }
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            throw methodNotAllowed(exchange);
        }
        Map<String, Object> body = readJsonBody(exchange);
        String code = requireStr(body, "code").trim().toUpperCase(Locale.ROOT);
        Double subtotal = num(body, "subtotal");
        if (subtotal == null || subtotal < 0) {
            throw ApiException.badRequest("Field 'subtotal' must be a non-negative number");
        }

        Optional<IDiscountStrategy> voucher = VoucherCatalog.find(code);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("code", code);
        data.put("valid", voucher.isPresent());
        if (voucher.isPresent()) {
            DiscountContext context = new DiscountContext(voucher.get());
            data.put("discountAmount", context.executeDiscount(subtotal, null));
            data.put("description", voucher.get().getDiscountDescription());
        } else {
            data.put("discountAmount", 0);
            data.put("description", "Invalid voucher code: " + code);
        }
        sendOk(exchange, 200, data, null);
    }
}
