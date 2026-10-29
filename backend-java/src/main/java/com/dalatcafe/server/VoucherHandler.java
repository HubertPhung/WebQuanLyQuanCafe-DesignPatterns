package com.dalatcafe.server;

import com.dalatcafe.dao.IVoucherDao;
import com.dalatcafe.model.UserAccount;
import com.dalatcafe.model.Voucher;
import com.dalatcafe.model.VoucherType;
import com.dalatcafe.model.VoucherUsage;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * /api/vouchers: quản lý voucher (MANAGER trở lên), danh sách mã đang chạy và kiểm tra mã (công
 * khai), giữ và nhả lượt (chỉ service key của storefront). Mọi quy tắc tính giảm nằm trong {@link
 * VoucherService}, nên xem trước và checkout không bao giờ lệch nhau.
 */
public class VoucherHandler extends ApiHandler {
    private static final Pattern CODE = Pattern.compile("^[A-Z0-9_-]{3,30}$");

    private final VoucherService service;
    private final IVoucherDao dao;

    public VoucherHandler(VoucherService service, IVoucherDao dao) {
        this.service = Objects.requireNonNull(service, "Voucher service must not be null");
        this.dao = Objects.requireNonNull(dao, "Voucher DAO must not be null");
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        List<String> parts = segments(exchange);
        if (parts.size() == 2) {
            switch (method) {
                case "GET" -> sendOk(exchange, 200, dao.findAll().stream().map(this::toJson).toList(), null);
                case "POST" -> create(exchange);
                default -> throw methodNotAllowed(exchange);
            }
            return;
        }
        String action = parts.get(2);
        if (parts.size() == 3) {
            switch (action) {
                case "active" -> {
                    if (!method.equals("GET")) throw methodNotAllowed(exchange);
                    active(exchange);
                    return;
                }
                case "validate" -> {
                    if (!method.equals("POST")) throw methodNotAllowed(exchange);
                    validate(exchange);
                    return;
                }
                case "redeem" -> {
                    if (!method.equals("POST")) throw methodNotAllowed(exchange);
                    redeem(exchange);
                    return;
                }
                case "release" -> {
                    if (!method.equals("POST")) throw methodNotAllowed(exchange);
                    release(exchange);
                    return;
                }
                default -> {
                }
            }
            int id = voucherId(action);
            switch (method) {
                case "PUT" -> update(exchange, id);
                case "DELETE" -> delete(exchange, id);
                default -> throw methodNotAllowed(exchange);
            }
            return;
        }
        if (parts.size() == 4 && parts.get(3).equals("usages")) {
            if (!method.equals("GET")) throw methodNotAllowed(exchange);
            int id = voucherId(action);
            find(id);
            List<Object> rows = new ArrayList<>();
            for (VoucherUsage usage : dao.findUsages(id)) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("userId", usage.userId());
                row.put("orderCode", usage.orderCode());
                row.put("discountAmount", usage.discountAmount());
                row.put("createdAt", usage.createdAt());
                rows.add(row);
            }
            sendOk(exchange, 200, rows, null);
            return;
        }
        throw ApiException.notFound("Unknown voucher resource");
    }

    private static int voucherId(String raw) {
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException e) {
            throw ApiException.notFound("Unknown voucher resource");
        }
    }

    private Voucher find(int id) {
        return dao.findById(id).orElseThrow(() -> ApiException.notFound("Voucher not found: " + id));
    }

    private void create(HttpExchange exchange) throws IOException {
        Voucher voucher = fromBody(readJsonBody(exchange), new Voucher());
        if (!dao.save(voucher)) throw conflict("Mã " + voucher.getCode() + " đã tồn tại.");
        sendOk(exchange, 201, toJson(find(voucher.getId())), "Voucher created");
    }

    private void update(HttpExchange exchange, int id) throws IOException {
        Voucher current = find(id);
        Voucher edited = fromBody(readJsonBody(exchange), current.copy());
        if (current.getUsedCount() > 0 && !current.getCode().equals(edited.getCode())) {
            throw conflict("Mã đã có người dùng nên không đổi được tên mã.");
        }
        if (edited.getMaxUses() != null && edited.getMaxUses() < current.getUsedCount()) {
            throw ApiException.badRequest("Tổng số lượt không được nhỏ hơn số lượt đã dùng (" + current.getUsedCount() + ").");
        }
        if (!dao.save(edited)) throw conflict("Mã " + edited.getCode() + " đã tồn tại.");
        sendOk(exchange, 200, toJson(find(id)), "Voucher updated");
    }

    /** Mã chưa ai dùng thì xóa hẳn; đã có lượt dùng thì chỉ tắt, để lịch sử đơn vẫn còn tên mã. */
    private void delete(HttpExchange exchange, int id) throws IOException {
        Voucher current = find(id);
        Map<String, Object> data = new LinkedHashMap<>();
        if (current.getUsedCount() == 0 && dao.findUsages(id).isEmpty()) {
            data.put("deleted", dao.deleteById(id));
            data.put("deactivated", false);
        } else {
            current.setActive(false);
            dao.save(current);
            data.put("deleted", false);
            data.put("deactivated", true);
        }
        sendOk(exchange, 200, data, null);
    }

    private void active(HttpExchange exchange) throws IOException {
        Instant now = service.now();
        List<Object> rows = new ArrayList<>();
        for (Voucher v : dao.findAll()) {
            if (v.stateAt(now) != Voucher.VoucherState.RUNNING) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", v.getCode());
            row.put("type", v.getType().name());
            row.put("value", v.getValue());
            row.put("maxDiscount", v.getMaxDiscount());
            row.put("minOrder", v.getMinOrder());
            row.put("perAccountLimit", v.getPerAccountLimit());
            row.put("firstOnlineOrderOnly", v.isFirstOnlineOrderOnly());
            row.put("endDate", v.getEndDate().toString());
            row.put("description", v.getDescription());
            rows.add(row);
        }
        sendOk(exchange, 200, rows, null);
    }

    private void validate(HttpExchange exchange) throws IOException {
        Map<String, Object> body = readJsonBody(exchange);
        String code = VoucherService.normalize(requireStr(body, "code"));
        double subtotal = subtotal(body);
        boolean storefront = isStorefront(exchange);
        VoucherService.Verdict verdict = service.check(code, subtotal, storefront ? userId(body) : null, storefront);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("code", code);
        data.put("valid", verdict.valid());
        data.put("reason", verdict.reason().name());
        data.put("discountAmount", verdict.discountAmount());
        data.put("shortfall", verdict.shortfall());
        data.put("description", verdict.message());
        data.put("firstOnlineOrderOnly", verdict.voucher() != null && verdict.voucher().isFirstOnlineOrderOnly());
        sendOk(exchange, 200, data, null);
    }

    private void redeem(HttpExchange exchange) throws IOException {
        requireStorefront(exchange);
        Map<String, Object> body = readJsonBody(exchange);
        VoucherService.Redemption redemption = service.redeem(requireStr(body, "code"), subtotal(body), userId(body),
                requireStr(body, "orderCode"), true);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("usageId", redemption.usageId());
        data.put("discountAmount", redemption.discountAmount());
        data.put("code", redemption.voucher().getCode());
        sendOk(exchange, 200, data, null);
    }

    private void release(HttpExchange exchange) throws IOException {
        requireStorefront(exchange);
        Map<String, Object> body = readJsonBody(exchange);
        sendOk(exchange, 200, Map.of("released", service.releaseOrder(requireStr(body, "orderCode"))), null);
    }

    private static boolean isStorefront(HttpExchange exchange) {
        return Boolean.TRUE.equals(exchange.getAttribute(SimpleAuthFilter.STOREFRONT_SERVICE_ATTRIBUTE));
    }

    /** Giữ và nhả lượt chỉ dành cho storefront (đơn COD); nhân viên không tự giữ lượt hộ khách. */
    private static void requireStorefront(HttpExchange exchange) {
        if (!isStorefront(exchange)) {
            UserAccount user = (UserAccount) exchange.getAttribute(SimpleAuthFilter.USER_ATTRIBUTE);
            throw new ApiException(403, "FORBIDDEN", "Only the storefront service can "
                    + (user == null ? "redeem vouchers" : "redeem vouchers, not role " + user.getRole()));
        }
    }

    private static double subtotal(Map<String, Object> body) {
        Double subtotal = num(body, "subtotal");
        if (subtotal == null || subtotal < 0) {
            throw ApiException.badRequest("Field 'subtotal' must be a non-negative number");
        }
        return subtotal;
    }

    private static Integer userId(Map<String, Object> body) {
        return body.get("userId") == null ? null : requireInt(body, "userId");
    }

    private static ApiException conflict(String message) {
        return new ApiException(409, "RESOURCE_CONFLICT", message);
    }

    private static Voucher fromBody(Map<String, Object> body, Voucher target) {
        String code = VoucherService.normalize(requireStr(body, "code"));
        if (code == null || !CODE.matcher(code).matches()) {
            throw ApiException.badRequest("Mã chỉ gồm chữ, số, '-' hoặc '_', dài 3–30 ký tự.");
        }
        VoucherType type;
        try {
            type = VoucherType.valueOf(requireStr(body, "type").trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("type must be PERCENT or FIXED");
        }
        Double value = num(body, "value");
        if (value == null || value <= 0 || (type == VoucherType.PERCENT && value > 100)) {
            throw ApiException.badRequest(type == VoucherType.PERCENT ? "Phần trăm giảm phải từ 1 đến 100." : "Số tiền giảm phải lớn hơn 0.");
        }
        Double maxDiscount = type == VoucherType.PERCENT ? num(body, "maxDiscount") : null;
        if (maxDiscount != null && maxDiscount <= 0) throw ApiException.badRequest("Mức giảm tối đa phải lớn hơn 0.");
        Double minOrder = num(body, "minOrder");
        if (minOrder != null && minOrder < 0) throw ApiException.badRequest("Đơn tối thiểu không được âm.");
        Integer maxUses = positiveOrNull(body, "maxUses", "Tổng số lượt");
        Integer perAccount = positiveOrNull(body, "perAccountLimit", "Số lần mỗi tài khoản");
        LocalDate start = date(body, "startDate");
        LocalDate end = date(body, "endDate");
        if (end.isBefore(start)) throw ApiException.badRequest("Ngày hết hạn phải sau hoặc bằng ngày bắt đầu.");

        target.setCode(code);
        target.setType(type);
        target.setValue(value);
        target.setMaxDiscount(maxDiscount);
        target.setMinOrder(minOrder == null ? 0 : minOrder);
        target.setMaxUses(maxUses);
        target.setPerAccountLimit(perAccount);
        target.setFirstOnlineOrderOnly(bool(body, "firstOnlineOrderOnly", false));
        target.setStartDate(start);
        target.setEndDate(end);
        String description = str(body, "description");
        target.setDescription(description == null ? null : description.trim());
        target.setActive(bool(body, "active", true));
        return target;
    }

    private static Integer positiveOrNull(Map<String, Object> body, String key, String label) {
        if (body.get(key) == null) return null;
        int value = requireInt(body, key);
        if (value < 1) throw ApiException.badRequest(label + " phải từ 1 trở lên, hoặc để trống nếu không giới hạn.");
        return value;
    }

    private static LocalDate date(Map<String, Object> body, String key) {
        try {
            return LocalDate.parse(requireStr(body, key));
        } catch (DateTimeException e) {
            throw ApiException.badRequest(key + " must be a date like 2026-11-11");
        }
    }

    private Map<String, Object> toJson(Voucher v) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", v.getId());
        json.put("code", v.getCode());
        json.put("type", v.getType().name());
        json.put("value", v.getValue());
        json.put("maxDiscount", v.getMaxDiscount());
        json.put("minOrder", v.getMinOrder());
        json.put("maxUses", v.getMaxUses());
        json.put("perAccountLimit", v.getPerAccountLimit());
        json.put("firstOnlineOrderOnly", v.isFirstOnlineOrderOnly());
        json.put("startDate", v.getStartDate().toString());
        json.put("endDate", v.getEndDate().toString());
        json.put("description", v.getDescription());
        json.put("active", v.isActive());
        json.put("usedCount", v.getUsedCount());
        json.put("state", v.stateAt(service.now()).name());
        return json;
    }
}
