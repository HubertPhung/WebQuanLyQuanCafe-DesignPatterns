package com.dalatcafe.server;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpContext;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpPrincipal;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;

/** HttpExchange attributes otherwise share the HttpContext map across concurrent requests. */
final class RequestScopedExchange extends HttpExchange {
    private final HttpExchange delegate;
    private final Map<String, Object> attributes = new HashMap<>();

    RequestScopedExchange(HttpExchange delegate) {
        this.delegate = delegate;
    }

    @Override public Object getAttribute(String name) {
        return attributes.containsKey(name) ? attributes.get(name) : delegate.getAttribute(name);
    }
    @Override public void setAttribute(String name, Object value) { attributes.put(name, value); }
    @Override public Headers getRequestHeaders() { return delegate.getRequestHeaders(); }
    @Override public Headers getResponseHeaders() { return delegate.getResponseHeaders(); }
    @Override public URI getRequestURI() { return delegate.getRequestURI(); }
    @Override public String getRequestMethod() { return delegate.getRequestMethod(); }
    @Override public HttpContext getHttpContext() { return delegate.getHttpContext(); }
    @Override public void close() { delegate.close(); }
    @Override public InputStream getRequestBody() { return delegate.getRequestBody(); }
    @Override public OutputStream getResponseBody() { return delegate.getResponseBody(); }
    @Override public void sendResponseHeaders(int code, long length) throws IOException { delegate.sendResponseHeaders(code, length); }
    @Override public InetSocketAddress getRemoteAddress() { return delegate.getRemoteAddress(); }
    @Override public int getResponseCode() { return delegate.getResponseCode(); }
    @Override public InetSocketAddress getLocalAddress() { return delegate.getLocalAddress(); }
    @Override public String getProtocol() { return delegate.getProtocol(); }
    @Override public void setStreams(InputStream input, OutputStream output) { delegate.setStreams(input, output); }
    @Override public HttpPrincipal getPrincipal() { return delegate.getPrincipal(); }
}
