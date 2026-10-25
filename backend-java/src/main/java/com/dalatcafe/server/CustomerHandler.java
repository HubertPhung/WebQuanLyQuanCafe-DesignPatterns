package com.dalatcafe.server;

import com.dalatcafe.dao.ICustomerDao;
import com.dalatcafe.model.Customer;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * GET /api/customers (có thể kèm ?phone=... để POS tra cứu thành viên): các thành viên tích điểm
 * kèm số điểm và hạng.
 */
public class CustomerHandler extends ApiHandler {
    private final ICustomerDao customerDao;

    public CustomerHandler(ICustomerDao customerDao) {
        this.customerDao = Objects.requireNonNull(customerDao, "Customer DAO must not be null");
    }

    @Override
    protected void route(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            throw methodNotAllowed(exchange);
        }
        if (segments(exchange).size() != 2) {
            throw ApiException.notFound("Unknown customer resource");
        }
        String phone = queryParam(exchange, "phone");
        List<Customer> customers = phone == null
                ? customerDao.findAll()
                : customerDao.findByPhone(phone).map(List::of).orElse(List.of());
        List<Object> data = new ArrayList<>();
        customers.stream()
                .sorted(Comparator.comparingDouble(Customer::getTotalSpent).reversed())
                .forEach(customer -> data.add(toJson(customer)));
        sendOk(exchange, 200, data, null);
    }

    static Map<String, Object> toJson(Customer customer) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", customer.getId());
        json.put("name", customer.getName());
        json.put("phone", customer.getPhone());
        json.put("email", customer.getEmail());
        json.put("totalOrders", customer.getTotalOrders());
        json.put("totalSpent", customer.getTotalSpent());
        json.put("loyaltyPoints", customer.getLoyaltyPoints());
        json.put("rank", customer.getRank() == null ? null : customer.getRank().name().toLowerCase(Locale.ROOT));
        json.put("lastVisit", customer.getLastVisit() == null ? null : customer.getLastVisit().toString());
        return json;
    }
}
