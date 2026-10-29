package com.dalatcafe.dao;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.net.URI;
import java.net.URISyntaxException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Nơi cấp kết nối JDBC tới PostgreSQL (Supabase). Kết nối lấy từ một pool nhỏ: {@link
 * Connection#close()} trên kết nối của pool sẽ trả nó về pool thay vì đóng socket, nên các DAO vẫn
 * dùng kiểu try-with-resources. {@link #isAvailable()} lưu kết quả trong vài giây, để kiểm tra sức
 * khỏe trên đường xử lý request không phải mở kết nối mới mỗi lần.
 */
public class JdbcDatabase {
    private static final Logger LOGGER = Logger.getLogger(JdbcDatabase.class.getName());
    private static final String DEFAULT_POSTGRES_DRIVER = "org.postgresql.Driver";
    static final int POOL_SIZE = 8;
    static final long HEALTH_TTL_MILLIS = 5_000;
    private static final int VALIDATION_TIMEOUT_SECONDS = 2;

    private static String customJdbcUrl = null;
    private static String customUser = null;
    private static String customPassword = null;

    private static final BlockingQueue<Connection> IDLE = new ArrayBlockingQueue<>(POOL_SIZE);
    private static volatile boolean lastHealth;
    private static volatile long lastHealthAt;

    static {
        try {
            Class.forName(DEFAULT_POSTGRES_DRIVER);
        } catch (ClassNotFoundException e) {
            LOGGER.log(Level.WARNING, "PostgreSQL JDBC Driver not found on classpath: " + e.getMessage());
        }
    }

    public static void setCustomConnection(String jdbcUrl, String user, String password) {
        customJdbcUrl = jdbcUrl;
        customUser = user;
        customPassword = password;
        closePool();
    }

    /** Một kết nối của pool; đóng nó là trả nó về pool. */
    public static Connection getConnection() throws SQLException {
        Connection physical;
        while ((physical = IDLE.poll()) != null) {
            if (isUsable(physical)) {
                return pooled(physical);
            }
            closeQuietly(physical);
        }
        return pooled(openPhysical());
    }

    private static Connection openPhysical() throws SQLException {
        if (customJdbcUrl != null) {
            return DriverManager.getConnection(customJdbcUrl, customUser, customPassword);
        }

        String rawUrl = System.getenv("DATABASE_URL");
        if (rawUrl == null || rawUrl.isBlank()) {
            rawUrl = System.getProperty("DATABASE_URL");
        }

        if (rawUrl == null || rawUrl.isBlank() || rawUrl.contains("[YOUR-PASSWORD]")) {
            throw new SQLException("DATABASE_URL environment variable is not configured or contains placeholder.");
        }

        return parseAndConnect(rawUrl.strip());
    }

    private static Connection parseAndConnect(String rawUrl) throws SQLException {
        if (rawUrl.startsWith("jdbc:postgresql:")) {
            return DriverManager.getConnection(rawUrl);
        }

        // Phân tích chuỗi dạng: postgresql://user:password@host:port/database
        String cleanUrl = rawUrl.replace("postgresql://", "http://").replace("postgres://", "http://");
        URI uri;
        try {
            uri = new URI(cleanUrl);
        } catch (URISyntaxException e) {
            // URL chứa mật khẩu, nên không báo ra URL lẫn thông báo lỗi của bộ phân tích (vì thông
            // báo đó trích lại URL).
            throw new SQLException("DATABASE_URL is not a valid postgresql:// URL (character " + e.getIndex()
                    + "); characters such as spaces, @ or # in the password must be percent-encoded");
        }

        String host = uri.getHost();
        int port = uri.getPort() == -1 ? 5432 : uri.getPort();
        String path = uri.getPath();
        String database = (path != null && path.length() > 1) ? path.substring(1) : "postgres";

        String userInfo = uri.getUserInfo();
        String user = "";
        String password = "";
        if (userInfo != null && userInfo.contains(":")) {
            String[] parts = userInfo.split(":", 2);
            user = parts[0];
            password = parts[1];
        } else if (userInfo != null) {
            user = userInfo;
        }

        // Mật khẩu được truyền cho driver thành một tham số riêng, để lỗi của driver không thể in
        // lại nó.
        String jdbcUrl = String.format("jdbc:postgresql://%s:%d/%s?sslmode=require", host, port, database);
        return DriverManager.getConnection(jdbcUrl, user, password);
    }

    private static boolean isUsable(Connection physical) {
        try {
            return !physical.isClosed() && physical.isValid(VALIDATION_TIMEOUT_SECONDS);
        } catch (SQLException e) {
            return false;
        }
    }

    private static Connection pooled(Connection physical) {
        InvocationHandler handler = new InvocationHandler() {
            private boolean released;

            @Override
            public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
                switch (method.getName()) {
                    case "close":
                        if (!released) {
                            released = true;
                            release(physical);
                        }
                        return null;
                    case "isClosed":
                        return released || physical.isClosed();
                    case "unwrap":
                    case "isWrapperFor":
                        break;
                    case "equals":
                        return proxy == args[0];
                    case "hashCode":
                        return System.identityHashCode(proxy);
                    case "toString":
                        return "Pooled(" + physical + ")";
                    default:
                        if (released) {
                            throw new SQLException("Connection already returned to the pool");
                        }
                }
                try {
                    return method.invoke(physical, args);
                } catch (InvocationTargetException e) {
                    throw e.getCause();
                }
            }
        };
        return (Connection) Proxy.newProxyInstance(JdbcDatabase.class.getClassLoader(),
                new Class<?>[]{Connection.class}, handler);
    }

    /** Đặt lại kết nối vừa mượn rồi cất vào pool, hoặc đóng nó khi pool đã đầy. */
    private static void release(Connection physical) {
        try {
            if (physical.isClosed()) {
                return;
            }
            if (!physical.getAutoCommit()) {
                physical.rollback();
                physical.setAutoCommit(true);
            }
            if (!IDLE.offer(physical)) {
                physical.close();
            }
        } catch (SQLException e) {
            closeQuietly(physical);
        }
    }

    /** Đóng mọi kết nối đang rảnh và xóa kết quả kiểm tra sức khỏe đã lưu. */
    public static void closePool() {
        Connection physical;
        while ((physical = IDLE.poll()) != null) {
            closeQuietly(physical);
        }
        lastHealthAt = 0;
    }

    private static void closeQuietly(Connection connection) {
        try {
            connection.close();
        } catch (SQLException ignored) {
            // Kết nối đã hỏng; không còn gì để giải phóng.
        }
    }

    /**
     * PostgreSQL có phản hồi không, lưu kết quả trong {@link #HEALTH_TTL_MILLIS} để kiểm tra trên
     * đường xử lý request vẫn nhẹ. Lần thất bại cũng được kiểm tra lại sau cùng khoảng thời gian
     * đó.
     */
    public static boolean isAvailable() {
        long now = System.currentTimeMillis();
        if (lastHealthAt != 0 && now - lastHealthAt < HEALTH_TTL_MILLIS) {
            return lastHealth;
        }
        boolean healthy;
        try (Connection conn = getConnection()) {
            healthy = conn.isValid(VALIDATION_TIMEOUT_SECONDS);
        } catch (Throwable e) {
            LOGGER.log(Level.INFO, "PostgreSQL JDBC not available, falling back to In-Memory: " + e.getMessage());
            healthy = false;
        }
        lastHealth = healthy;
        lastHealthAt = now;
        return healthy;
    }

    /**
     * Tạo schema JDBC trên database mới và nâng cấp database cũ tại chỗ. Mọi câu lệnh đều chạy lại
     * được (IF NOT EXISTS / khối DO có kiểm tra), và khóa ngoại được thêm với NOT VALID để các dòng
     * ghi trước phiên bản này được giữ nguyên.
     */
    public static void initializeSchema(Connection conn) throws SQLException {
        String ddl = """
            CREATE TABLE IF NOT EXISTS tables (
                id INT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                seats INT DEFAULT 2,
                zone VARCHAR(50) DEFAULT 'Main Floor',
                status VARCHAR(30) DEFAULT 'AVAILABLE',
                guest_count INT DEFAULT 0,
                occupied_since TIMESTAMP WITH TIME ZONE,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS menu_items (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100),
                kind VARCHAR(30) DEFAULT 'menu',
                unit VARCHAR(30) DEFAULT 'ly',
                cost_price NUMERIC(12,2) DEFAULT 0,
                sell_price NUMERIC(12,2) DEFAULT 0,
                in_stock BOOLEAN DEFAULT TRUE,
                recipe TEXT,
                image_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                order_code VARCHAR(50) UNIQUE NOT NULL,
                customer VARCHAR(255) DEFAULT 'Walk-in',
                table_id INT,
                order_type VARCHAR(30) DEFAULT 'DINE_IN',
                subtotal NUMERIC(12,2) DEFAULT 0,
                vat_amount NUMERIC(12,2) DEFAULT 0,
                discount_amount NUMERIC(12,2) DEFAULT 0,
                total NUMERIC(12,2) DEFAULT 0,
                payment_method VARCHAR(30) DEFAULT 'CASH',
                payment_status VARCHAR(30) DEFAULT 'UNPAID',
                status VARCHAR(30) DEFAULT 'PENDING',
                note TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE
            );

            CREATE TABLE IF NOT EXISTS reservations (
                id SERIAL PRIMARY KEY,
                reservation_code VARCHAR(50) UNIQUE NOT NULL,
                customer VARCHAR(255) NOT NULL,
                contact VARCHAR(50) NOT NULL,
                email VARCHAR(255),
                date_time TIMESTAMP WITH TIME ZONE NOT NULL,
                table_name VARCHAR(100),
                table_id INT,
                guests INT DEFAULT 2,
                status VARCHAR(30) DEFAULT 'PENDING',
                note TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255),
                total_orders INT DEFAULT 0,
                total_spent NUMERIC(14,2) DEFAULT 0,
                loyalty_points INT DEFAULT 0,
                rank VARCHAR(30) DEFAULT 'BRONZE',
                last_visit TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255),
                google_subject VARCHAR(255) UNIQUE,
                role VARCHAR(30) NOT NULL DEFAULT 'CUSTOMER',
                active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login_at TIMESTAMP WITH TIME ZONE
            );

            -- Store settings of the SystemConfigManager Singleton, one row per setting.
            CREATE TABLE IF NOT EXISTS store_config (
                config_key VARCHAR(60) PRIMARY KEY,
                config_value TEXT NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- List-valued fields (added after the first release, so ALTER keeps old databases working).
            ALTER TABLE tables ADD COLUMN IF NOT EXISTS image_url TEXT;
            ALTER TABLE tables ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
            ALTER TABLE reservations ADD COLUMN IF NOT EXISTS table_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS variations JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE reservations ADD COLUMN IF NOT EXISTS pre_orders JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE reservations ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
            -- End of the booked range; NULL on bookings made before it existed (they hold two hours).
            ALTER TABLE reservations ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
            -- Branch of each table, order and booking; rows from before branches belong to the first one.
            ALTER TABLE tables ADD COLUMN IF NOT EXISTS branch VARCHAR(40) NOT NULL DEFAULT 'phan-dinh-phung';
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch VARCHAR(40) NOT NULL DEFAULT 'phan-dinh-phung';
            ALTER TABLE reservations ADD COLUMN IF NOT EXISTS branch VARCHAR(40) NOT NULL DEFAULT 'phan-dinh-phung';

            -- Vouchers managed by staff; NULL limits mean unlimited. One usage row per redeemed use.
            CREATE TABLE IF NOT EXISTS vouchers (
                id SERIAL PRIMARY KEY,
                code VARCHAR(30) UNIQUE NOT NULL,
                type VARCHAR(10) NOT NULL,
                value NUMERIC(12,2) NOT NULL,
                max_discount NUMERIC(12,2),
                min_order NUMERIC(12,2) NOT NULL DEFAULT 0,
                max_uses INT,
                per_account_limit INT,
                first_online_order_only BOOLEAN NOT NULL DEFAULT FALSE,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                description TEXT,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                used_count INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS voucher_usages (
                id SERIAL PRIMARY KEY,
                voucher_id INT NOT NULL REFERENCES vouchers(id),
                user_id INT,
                order_code VARCHAR(50) UNIQUE,
                discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_voucher_usages_voucher_user ON voucher_usages(voucher_id, user_id);
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS voucher_code VARCHAR(30);
            -- Usages must never vanish with their voucher; databases created with ON DELETE CASCADE are switched over.
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'voucher_usages_voucher_id_fkey' AND confdeltype = 'c') THEN
                    ALTER TABLE voucher_usages DROP CONSTRAINT voucher_usages_voucher_id_fkey;
                    ALTER TABLE voucher_usages ADD CONSTRAINT voucher_usages_voucher_id_fkey
                        FOREIGN KEY (voucher_id) REFERENCES vouchers(id);
                END IF;
            END $$;

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_table') THEN
                    ALTER TABLE orders ADD CONSTRAINT fk_orders_table
                        FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL NOT VALID;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_reservations_table') THEN
                    ALTER TABLE reservations ADD CONSTRAINT fk_reservations_table
                        FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL NOT VALID;
                END IF;
            END $$;

            CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
            CREATE INDEX IF NOT EXISTS idx_reservations_table_id ON reservations(table_id);
            CREATE INDEX IF NOT EXISTS idx_reservations_date_time ON reservations(date_time);
            CREATE INDEX IF NOT EXISTS idx_reservations_user_date ON reservations(user_id, date_time DESC);
            CREATE INDEX IF NOT EXISTS idx_reservations_guest_email ON reservations(LOWER(BTRIM(email)), date_time DESC) WHERE user_id IS NULL;
            CREATE INDEX IF NOT EXISTS idx_tables_branch ON tables(branch);
            CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch);
            CREATE INDEX IF NOT EXISTS idx_reservations_branch ON reservations(branch);
        """;

        try (Statement stmt = conn.createStatement()) {
            stmt.execute(ddl);
        }
    }

    /**
     * Đẩy mỗi sequence SERIAL vượt qua id lớn nhất. Cần làm sau khi chèn dòng với id cố định (dữ
     * liệu mẫu, upsert) để id tự sinh tiếp theo không bị trùng.
     */
    public static void syncSequences(Connection conn) throws SQLException {
        String sql = """
            SELECT setval(pg_get_serial_sequence('menu_items', 'id'), COALESCE((SELECT MAX(id) FROM menu_items), 0) + 1, false);
            SELECT setval(pg_get_serial_sequence('orders', 'id'), COALESCE((SELECT MAX(id) FROM orders), 0) + 1, false);
            SELECT setval(pg_get_serial_sequence('reservations', 'id'), COALESCE((SELECT MAX(id) FROM reservations), 0) + 1, false);
            SELECT setval(pg_get_serial_sequence('customers', 'id'), COALESCE((SELECT MAX(id) FROM customers), 0) + 1, false);
            SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 0) + 1, false);
            SELECT setval(pg_get_serial_sequence('vouchers', 'id'), COALESCE((SELECT MAX(id) FROM vouchers), 0) + 1, false);
            SELECT setval(pg_get_serial_sequence('voucher_usages', 'id'), COALESCE((SELECT MAX(id) FROM voucher_usages), 0) + 1, false);
        """;
        try (Statement stmt = conn.createStatement()) {
            stmt.execute(sql);
        }
    }
}
