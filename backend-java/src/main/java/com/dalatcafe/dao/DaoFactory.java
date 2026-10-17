package com.dalatcafe.dao;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Factory class providing access to DAO implementations with zero-crash fallback.
 */
public class DaoFactory {
    private static final Logger LOGGER = Logger.getLogger(DaoFactory.class.getName());
    private static volatile DaoFactory instance;

    private DaoMode mode;

    // In-memory singletons
    private final ITableDao inMemoryTableDao = new InMemoryTableDao();
    private final IMenuDao inMemoryMenuDao = new InMemoryMenuDao();
    private final IOrderDao inMemoryOrderDao = new InMemoryOrderDao();
    private final IReservationDao inMemoryReservationDao = new InMemoryReservationDao();
    private final ICustomerDao inMemoryCustomerDao = new InMemoryCustomerDao();
    private final IUserDao inMemoryUserDao = new InMemoryUserDao();

    // JDBC singletons
    private final ITableDao jdbcTableDao = new JdbcTableDao();
    private final IMenuDao jdbcMenuDao = new JdbcMenuDao();
    private final IOrderDao jdbcOrderDao = new JdbcOrderDao();
    private final IReservationDao jdbcReservationDao = new JdbcReservationDao();
    private final ICustomerDao jdbcCustomerDao = new JdbcCustomerDao();
    private final IUserDao jdbcUserDao = new JdbcUserDao();

    private DaoFactory() {
        // Auto-detect JDBC availability, default to IN_MEMORY
        if (JdbcDatabase.isAvailable() && prepareJdbcStore(jdbcTableDao, jdbcMenuDao)) {
            this.mode = DaoMode.JDBC;
            LOGGER.info("DaoFactory initialized in JDBC mode (PostgreSQL connected).");
        } else {
            this.mode = DaoMode.IN_MEMORY;
            LOGGER.info("DaoFactory initialized in IN_MEMORY mode (Zero-crash fallback active).");
        }
    }

    /**
     * Creates or upgrades the JDBC schema, seeds the floor plan and the menu when they are
     * empty (orders reference tables by foreign key), then re-aligns the id sequences.
     * Returns false when the schema cannot be prepared, so the caller stays in memory.
     */
    static boolean prepareJdbcStore(ITableDao tables, IMenuDao menu) {
        try (Connection conn = JdbcDatabase.getConnection()) {
            JdbcDatabase.initializeSchema(conn);
            InMemoryDatabase seed = InMemoryDatabase.getInstance();
            if (tables.findAll().isEmpty()) {
                seed.getTables().values().forEach(tables::save);
                LOGGER.info("Seeded " + seed.getTables().size() + " tables into PostgreSQL.");
            }
            if (menu.findAll().isEmpty()) {
                seed.getMenuItems().values().forEach(menu::save);
                LOGGER.info("Seeded " + seed.getMenuItems().size() + " menu items into PostgreSQL.");
            }
            JdbcDatabase.syncSequences(conn);
            return true;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Could not prepare the PostgreSQL schema: " + e.getMessage(), e);
            return false;
        }
    }

    public static DaoFactory getInstance() {
        if (instance == null) {
            synchronized (DaoFactory.class) {
                if (instance == null) {
                    instance = new DaoFactory();
                }
            }
        }
        return instance;
    }

    public DaoMode getMode() {
        return mode;
    }

    public void setMode(DaoMode mode) {
        if (mode == DaoMode.JDBC && !(JdbcDatabase.isAvailable() && prepareJdbcStore(jdbcTableDao, jdbcMenuDao))) {
            LOGGER.log(Level.WARNING, "Cannot switch to JDBC mode: Database connection unavailable. Remaining in IN_MEMORY mode.");
            this.mode = DaoMode.IN_MEMORY;
            return;
        }
        this.mode = mode;
        LOGGER.info("DaoFactory mode changed to: " + mode);
    }

    public ITableDao getTableDao() {
        return (mode == DaoMode.JDBC && JdbcDatabase.isAvailable()) ? jdbcTableDao : inMemoryTableDao;
    }

    public IMenuDao getMenuDao() {
        return (mode == DaoMode.JDBC && JdbcDatabase.isAvailable()) ? jdbcMenuDao : inMemoryMenuDao;
    }

    public IOrderDao getOrderDao() {
        return (mode == DaoMode.JDBC && JdbcDatabase.isAvailable()) ? jdbcOrderDao : inMemoryOrderDao;
    }

    public IReservationDao getReservationDao() {
        return (mode == DaoMode.JDBC && JdbcDatabase.isAvailable()) ? jdbcReservationDao : inMemoryReservationDao;
    }

    public ICustomerDao getCustomerDao() {
        return (mode == DaoMode.JDBC && JdbcDatabase.isAvailable()) ? jdbcCustomerDao : inMemoryCustomerDao;
    }

    public IUserDao getUserDao() {
        return (mode == DaoMode.JDBC && JdbcDatabase.isAvailable()) ? jdbcUserDao : inMemoryUserDao;
    }
}

