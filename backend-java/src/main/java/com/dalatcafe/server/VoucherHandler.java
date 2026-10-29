package com.dalatcafe.server;

import com.dalatcafe.dao.DaoFactory;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * POST /api/vouchers/validate: xem trước một voucher trên một tạm tính bằng đúng Strategy mà
 * checkout áp dụng (xem {@link VoucherService}). Mã không tồn tại vẫn trả 200 với {@code
 * valid:false}, để storefront hiện lý do ngay tại chỗ.
 */
public class VoucherHandler extends ApiHandler {
    private final VoucherService service = new VoucherService(DaoFactory.getInstance().getVoucherDao(), Clock.systemUTC());

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
        String code = VoucherService.normalize(requireStr(body, "code"));
        Double subtotal = num(body, "subtotal");
        if (subtotal == null || subtotal < 0) {
            throw ApiException.badRequest("Field 'subtotal' must be a non-negative number");
        }
        VoucherService.Verdict verdict = service.check(code, subtotal, null, false);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("code", code);
        data.put("valid", verdict.valid());
        data.put("discountAmount", verdict.discountAmount());
        data.put("description", verdict.message());
        sendOk(exchange, 200, data, null);
    }
}
