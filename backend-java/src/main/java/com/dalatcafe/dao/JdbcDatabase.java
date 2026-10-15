package com.dalatcafe.dao;

import java.net.URI;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * PostgreSQL Supabase JDBC Connection Provider with zero-crash fallback.
 */
public class JdbcDatabase {
    private static final Logger LOGGER = Logger.getLogger(JdbcDatabase.class.getName());
    private static final String DEFAULT_POSTGRES_DRIVER = "org.postgresql.Driver";

    private static String customJdbcUrl = null;
    private static String customUser = null;
    private static String customPassword = null;

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
    }

    public static Connection getConnection() throws SQLException {
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

        return parseAndConnect(rawUrl);
    }

    private static Connection parseAndConnect(String rawUrl) throws SQLException {
        if (rawUrl.startsWith("jdbc:postgresql:")) {
            return DriverManager.getConnection(rawUrl);
        }

        // Parse uri format: postgresql://user:password@host:port/database
        try {
            String cleanUrl = rawUrl.replace("postgresql://", "http://").replace("postgres://", "http://");
            URI uri = URI.create(cleanUrl);

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

            String jdbcUrl = String.format("jdbc:postgresql://%s:%d/%s?sslmode=require", host, port, database);
            return DriverManager.getConnection(jdbcUrl, user, password);
        } catch (Exception e) {
            throw new SQLException("Failed to parse PostgreSQL DATABASE_URL: " + e.getMessage(), e);
        }
    }

    /**
     * Non-blocking availability check (within 2s timeout).
     */
    public static boolean isAvailable() {
        try (Connection conn = getConnection()) {
            return conn != null && conn.isValid(2);
        } catch (Throwable e) {
            LOGGER.log(Level.INFO, "PostgreSQL JDBC not available, falling back to In-Memory: " + e.getMessage());
            return false;
        }
    }

    /**
     * Initializes required schema tables if connecting to a fresh database.
     */
    public static void initializeSchema(Connection conn) throws SQLException {
        String ddl = """
            CREATE TABLE IF NOT EXISTS tables (
                id INT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                seats INT DEFAULT 2,
                zone VARCHAR(50) DEFAULT 'Main Floor',
                status VARCHAR(30) DEFAULT 'available',
                guest_count INT DEFAULT 0,
                occupied_since TIMESTAMP WITH TIME ZONE,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS menu_items (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100),
                kind VARCHAR(30) DEFAULT 'menu',
                stock_qty NUMERIC(10,2) DEFAULT 0,
                unit VARCHAR(30) DEFAULT 'ly',
                low_stock_threshold NUMERIC(10,2) DEFAULT 10,
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
                order_type VARCHAR(30) DEFAULT 'dine-in',
                subtotal NUMERIC(12,2) DEFAULT 0,
                vat_amount NUMERIC(12,2) DEFAULT 0,
                discount_amount NUMERIC(12,2) DEFAULT 0,
                total NUMERIC(12,2) DEFAULT 0,
                payment_method VARCHAR(30) DEFAULT 'cash',
                payment_status VARCHAR(30) DEFAULT 'unpaid',
                status VARCHAR(30) DEFAULT 'pending',
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
                status VARCHAR(30) DEFAULT 'pending',
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
        """;

        try (Statement stmt = conn.createStatement()) {
            stmt.execute(ddl);
        }
    }
}

