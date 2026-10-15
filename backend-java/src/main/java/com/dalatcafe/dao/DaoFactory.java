package com.dalatcafe.dao;

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

    // JDBC singletons
    private final ITableDao jdbcTableDao = new JdbcTableDao();
    private final IMenuDao jdbcMenuDao = new JdbcMenuDao();
    private final IOrderDao jdbcOrderDao = new JdbcOrderDao();
    private final IReservationDao jdbcReservationDao = new JdbcReservationDao();
    private final ICustomerDao jdbcCustomerDao = new JdbcCustomerDao();

    private DaoFactory() {
        // Auto-detect JDBC availability, default to IN_MEMORY
        if (JdbcDatabase.isAvailable()) {
            this.mode = DaoMode.JDBC;
            LOGGER.info("DaoFactory initialized in JDBC mode (PostgreSQL connected).");
        } else {
            this.mode = DaoMode.IN_MEMORY;
            LOGGER.info("DaoFactory initialized in IN_MEMORY mode (Zero-crash fallback active).");
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
        if (mode == DaoMode.JDBC && !JdbcDatabase.isAvailable()) {
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
}

