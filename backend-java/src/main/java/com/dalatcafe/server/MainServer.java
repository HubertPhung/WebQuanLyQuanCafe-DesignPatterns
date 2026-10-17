package com.dalatcafe.server;

import com.dalatcafe.dao.DaoFactory;
import com.dalatcafe.dao.DaoMode;
import com.dalatcafe.dao.JdbcDatabase;
import com.dalatcafe.patterns.facade.PosCheckoutFacade;
import com.dalatcafe.patterns.observer.KitchenNotificationObserver;
import com.dalatcafe.patterns.observer.OrderEventSubject;
import com.dalatcafe.patterns.observer.TableStatusSyncObserver;
import com.sun.net.httpserver.HttpContext;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;
import java.util.function.BooleanSupplier;
import java.util.logging.Logger;

/**
 * Boots the embedded Java SE HttpServer (default port 8080) and wires the REST handlers.
 */
public class MainServer {
    private static final Logger LOGGER = Logger.getLogger(MainServer.class.getName());
    public static final int DEFAULT_PORT = 8080;

    private final HttpServer server;

    public MainServer(int port, DaoFactory daos, BooleanSupplier databaseHealthy) throws IOException {
        OrderEventSubject subject = new OrderEventSubject();
        subject.attach(new TableStatusSyncObserver(daos.getTableDao()));
        subject.attach(new KitchenNotificationObserver());
        PosCheckoutFacade facade = new PosCheckoutFacade(daos.getOrderDao(), daos.getMenuDao(), subject);

        server = HttpServer.create(new InetSocketAddress(port), 0);
        register("/api/menu", new MenuHandler(daos.getMenuDao()));
        register("/api/orders", new OrderHandler(daos.getOrderDao(), daos.getMenuDao(),
                daos.getTableDao(), daos.getCustomerDao(), subject, databaseHealthy));
        register("/api/customers", new CustomerHandler(daos.getCustomerDao()));
        register("/api/analytics", new AnalyticsHandler(daos.getOrderDao(), daos.getMenuDao(), daos.getTableDao()));
        register("/api/vouchers", new VoucherHandler());
        register("/api/config", new ConfigHandler());
        register("/api/tables", new TableHandler(daos.getTableDao()));
        register("/api/reservations", new ReservationHandler(daos.getReservationDao(), daos.getTableDao(), daos.getOrderDao()));
        register("/api/checkout", new CheckoutHandler(facade, daos.getCustomerDao(), databaseHealthy));
        server.setExecutor(Executors.newFixedThreadPool(8));
    }

    private void register(String path, ApiHandler handler) {
        HttpContext context = server.createContext(path, handler);
        context.getFilters().add(new CorsHandler());
        context.getFilters().add(new SimpleAuthFilter());
    }

    public void start() {
        server.start();
        LOGGER.info("HTTP server listening on port " + getPort());
    }

    public void stop() {
        server.stop(0);
        ((java.util.concurrent.ExecutorService) server.getExecutor()).shutdownNow();
    }

    public int getPort() {
        return server.getAddress().getPort();
    }

    public static void main(String[] args) throws IOException {
        int port = DEFAULT_PORT;
        if (args.length > 0) {
            port = Integer.parseInt(args[0]);
        }
        DaoFactory daos = DaoFactory.getInstance();
        // Fail closed: with a configured JDBC store, a lost connection must not fall back to memory.
        BooleanSupplier healthy = () -> daos.getMode() != DaoMode.JDBC || JdbcDatabase.isAvailable();
        MainServer server = new MainServer(port, daos, healthy);
        server.start();
        Runtime.getRuntime().addShutdownHook(new Thread(server::stop));
    }
}
