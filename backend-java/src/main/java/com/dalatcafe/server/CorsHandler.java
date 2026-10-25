package com.dalatcafe.server;

import com.sun.net.httpserver.Filter;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;

/**
 * Thêm các header CORS chuẩn vào mọi phản hồi và trả lời request OPTIONS kiểm tra trước
 * (preflight).
 */
public class CorsHandler extends Filter {
    @Override
    public void doFilter(HttpExchange exchange, Chain chain) throws IOException {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers",
                "Content-Type, Authorization, X-User-Role, Accept");
        exchange.getResponseHeaders().set("Access-Control-Max-Age", "86400");
        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return;
        }
        chain.doFilter(exchange);
    }

    @Override
    public String description() {
        return "CORS headers and preflight handling";
    }
}
