package com.dalatcafe.dao;

import com.dalatcafe.model.Branches;
import com.dalatcafe.model.Table;
import java.util.List;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Lớp Factory cung cấp các bản cài đặt DAO, có cơ chế dự phòng để không bao giờ sập (zero-crash).
 */
public class DaoFactory {
    private static final Logger LOGGER = Logger.getLogger(DaoFactory.class.getName());
    private static volatile DaoFactory instance;

    private DaoMode mode;

    // Các singleton in-memory
    private final ITableDao inMemoryTableDao = new InMemoryTableDao();
    private final IMenuDao inMemoryMenuDao = new InMemoryMenuDao();
    private final IOrderDao inMemoryOrderDao = new InMemoryOrderDao();
    private final IReservationDao inMemoryReservationDao = new InMemoryReservationDao();
    private final ICustomerDao inMemoryCustomerDao = new InMemoryCustomerDao();
    private final IUserDao inMemoryUserDao = new InMemoryUserDao();
    private final IConfigDao inMemoryConfigDao = new InMemoryConfigDao();
    private final IVoucherDao inMemoryVoucherDao = new InMemoryVoucherDao();

    // Các singleton JDBC
    private final ITableDao jdbcTableDao = new JdbcTableDao();
    private final IMenuDao jdbcMenuDao = new JdbcMenuDao();
    private final IOrderDao jdbcOrderDao = new JdbcOrderDao();
    private final IReservationDao jdbcReservationDao = new JdbcReservationDao();
    private final ICustomerDao jdbcCustomerDao = new JdbcCustomerDao();
    private final IUserDao jdbcUserDao = new JdbcUserDao();
    private final IConfigDao jdbcConfigDao = new JdbcConfigDao();

    private DaoFactory() {
        // Tự phát hiện JDBC có dùng được không, mặc định là IN_MEMORY
        if (JdbcDatabase.isAvailable() && prepareJdbcStore(jdbcTableDao, jdbcMenuDao)) {
            this.mode = DaoMode.JDBC;
            LOGGER.info("DaoFactory initialized in JDBC mode (PostgreSQL connected).");
        } else {
            this.mode = DaoMode.IN_MEMORY;
            LOGGER.info("DaoFactory initialized in IN_MEMORY mode (Zero-crash fallback active).");
        }
    }

    /**
     * Tạo hoặc nâng cấp schema JDBC, nạp sơ đồ bàn và thực đơn mẫu khi chúng còn trống (đơn hàng
     * tham chiếu bàn qua khóa ngoại), rồi căn lại các sequence id. Trả về false khi không chuẩn bị
     * được schema, để nơi gọi tiếp tục chạy trong bộ nhớ.
     */
    static boolean prepareJdbcStore(ITableDao tables, IMenuDao menu) {
        try (Connection conn = JdbcDatabase.getConnection()) {
            JdbcDatabase.initializeSchema(conn);
            InMemoryDatabase seed = InMemoryDatabase.getInstance();
            if (tables.findAll().isEmpty()) {
                seed.getTables().values().forEach(tables::save);
                LOGGER.info("Seeded " + seed.getTables().size() + " tables into PostgreSQL.");
            } else if (tables.findAll().stream().noneMatch(t -> Branches.BUI_THI_XUAN.equals(t.getBranch()))) {
                // Sơ đồ bàn được lưu từ trước khi có chi nhánh: tạo bàn riêng cho chi nhánh thứ
                // hai.
                List<Table> branchTwo = InMemoryDatabase.branchTwoTables(tables.nextId());
                branchTwo.forEach(tables::save);
                LOGGER.info("Seeded " + branchTwo.size() + " tables for branch " + Branches.BUI_THI_XUAN + ".");
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

    public IConfigDao getConfigDao() {
        return (mode == DaoMode.JDBC && JdbcDatabase.isAvailable()) ? jdbcConfigDao : inMemoryConfigDao;
    }

    public IVoucherDao getVoucherDao() {
        return inMemoryVoucherDao;
    }
}

