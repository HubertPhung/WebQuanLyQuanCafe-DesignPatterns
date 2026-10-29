package com.dalatcafe.server;

import com.dalatcafe.dao.DaoFactory;
import com.dalatcafe.dao.DaoMode;
import com.dalatcafe.dao.IUserDao;
import com.dalatcafe.dao.JdbcDatabase;
import com.dalatcafe.patterns.facade.PosCheckoutFacade;
import com.dalatcafe.patterns.observer.KitchenNotificationObserver;
import com.dalatcafe.patterns.observer.OrderEventSubject;
import com.dalatcafe.patterns.singleton.SystemConfigManager;
import com.dalatcafe.patterns.observer.TableStatusSyncObserver;
import com.dalatcafe.patterns.observer.ReservationOrderSyncObserver;
import com.dalatcafe.patterns.observer.VoucherReleaseObserver;
import com.dalatcafe.security.AdminBootstrap;
import com.dalatcafe.security.AuthSettings;
import com.dalatcafe.security.LoginThrottle;
import com.dalatcafe.security.PasswordHasher;
import com.dalatcafe.security.TokenService;
import com.dalatcafe.util.EnvFile;
import com.sun.net.httpserver.HttpContext;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Path;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.function.BooleanSupplier;
import java.util.logging.Logger;

/**
 * Khởi động Java SE HttpServer nhúng (mặc định cổng 8080) và nối các REST handler.
 */
public class MainServer {
    private static final Logger LOGGER = Logger.getLogger(MainServer.class.getName());
    public static final int DEFAULT_PORT = 8080;

    private final HttpServer server;
    private final TokenService tokens;
    private final IUserDao users;
    private final boolean allowRoleHeader;
    private final String serviceKey;
    private final java.util.concurrent.ScheduledExecutorService reservationTimer = Executors.newSingleThreadScheduledExecutor(task -> {
        Thread thread = new Thread(task, "reservation-no-shows");
        thread.setDaemon(true);
        return thread;
    });
    private final ReservationHandler reservations;

    /**
     * Server cho phát triển và test: khóa token ngẫu nhiên, chấp nhận header X-User-Role và hash
     * mật khẩu nhẹ để test chạy nhanh. {@link #main} dùng constructor đầy đủ.
     */
    public MainServer(int port, DaoFactory daos, BooleanSupplier databaseHealthy) throws IOException {
        this(port, daos, databaseHealthy, AuthSettings.withRoleHeader(), new PasswordHasher(10_000));
    }

    public MainServer(int port, DaoFactory daos, BooleanSupplier databaseHealthy, AuthSettings auth,
                      PasswordHasher hasher) throws IOException {
        this.users = daos.getUserDao();
        this.tokens = new TokenService(auth.jwtSecret(), auth.tokenTtl(), Clock.systemUTC());
        this.allowRoleHeader = auth.allowRoleHeader();
        this.serviceKey = auth.serviceKey();
        // Một VoucherService dùng chung cho kiểm tra mã, checkout và đồng bộ đơn.
        VoucherService vouchers = new VoucherService(daos.getVoucherDao(), Clock.systemUTC());
        OrderEventSubject subject = new OrderEventSubject();
        // Dữ liệu trước (bàn, phiếu đặt), phiếu cho quầy pha chế sau cùng: số nhỏ hơn được báo
        // trước.
        subject.attach(new TableStatusSyncObserver(daos.getTableDao(), daos.getOrderDao()), 10);
        subject.attach(new ReservationOrderSyncObserver(daos.getReservationDao()), 20);
        subject.attach(new VoucherReleaseObserver(vouchers), 30);
        subject.attach(new KitchenNotificationObserver(), 90);
        PosCheckoutFacade facade = new PosCheckoutFacade(daos.getOrderDao(), daos.getMenuDao(), subject);

        server = HttpServer.create(new InetSocketAddress(port), 0);
        register("/api/auth", new AuthHandler(users, hasher, tokens,
                new LoginThrottle(LoginThrottle.DEFAULT_MAX_FAILURES, LoginThrottle.DEFAULT_WINDOW, Clock.systemUTC()),
                auth.serviceKey()));
        register("/api/users", new UserHandler(users, hasher));
        register("/api/menu", new MenuHandler(daos.getMenuDao()));
        register("/api/orders", new OrderHandler(daos.getOrderDao(), daos.getMenuDao(),
                daos.getTableDao(), daos.getCustomerDao(), subject, vouchers, databaseHealthy));
        register("/api/customers", new CustomerHandler(daos.getCustomerDao()));
        register("/api/analytics", new AnalyticsHandler(daos.getOrderDao(), daos.getMenuDao(), daos.getTableDao()));
        register("/api/vouchers", new VoucherHandler(vouchers, daos.getVoucherDao()));
        register("/api/config", new ConfigHandler());
        register("/api/tables", new TableHandler(daos.getTableDao(), daos.getOrderDao(), daos.getReservationDao()));
        reservations = new ReservationHandler(daos.getReservationDao(), daos.getTableDao(), daos.getOrderDao(), daos.getMenuDao());
        register("/api/reservations", reservations);
        register("/api/checkout", new CheckoutHandler(facade, daos.getCustomerDao(), daos.getTableDao(),
                daos.getOrderDao(), daos.getReservationDao(), vouchers, databaseHealthy));
        server.setExecutor(Executors.newFixedThreadPool(8));
    }

    private void register(String path, ApiHandler handler) {
        HttpContext context = server.createContext(path, handler);
        context.getFilters().add(new CorsHandler());
        context.getFilters().add(new SimpleAuthFilter(tokens, users, allowRoleHeader, serviceKey));
    }

    public void start() {
        server.start();
        reservationTimer.scheduleAtFixedRate(() -> {
            try { reservations.expireNoShows(java.time.Instant.now()); }
            catch (RuntimeException error) { LOGGER.log(java.util.logging.Level.WARNING, "Could not expire no-show reservations", error); }
        }, 30, 30, java.util.concurrent.TimeUnit.SECONDS);
        LOGGER.info("HTTP server listening on port " + getPort());
    }

    public void stop() {
        reservationTimer.shutdownNow();
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
        // Cài đặt trong backend-java/.env bổ sung những gì biến môi trường còn thiếu; tầng JDBC đọc
        // DATABASE_URL từ system property khi chính biến đó chưa được đặt.
        Map<String, String> env = EnvFile.withFile(System.getenv(), Path.of(".env"));
        env.forEach((key, value) -> {
            if (System.getenv(key) == null && System.getProperty(key) == null) {
                System.setProperty(key, value);
            }
        });
        DaoFactory daos = DaoFactory.getInstance();
        // Nạp cài đặt quán đã lưu (PostgreSQL ở chế độ JDBC) trước request đầu tiên.
        SystemConfigManager.getInstance().attachStore(daos.getConfigDao());
        // Fail closed: khi đã cấu hình kho JDBC, mất kết nối không được chuyển sang lưu trong bộ
        // nhớ.
        BooleanSupplier healthy = () -> daos.getMode() != DaoMode.JDBC || JdbcDatabase.isAvailable();
        AuthSettings auth = AuthSettings.fromEnvironment(env);
        PasswordHasher hasher = new PasswordHasher();
        AdminBootstrap.ensureAdmin(daos.getUserDao(), hasher, env);
        MainServer server = new MainServer(port, daos, healthy, auth, hasher);
        server.start();
        Runtime.getRuntime().addShutdownHook(new Thread(server::stop));
    }
}
