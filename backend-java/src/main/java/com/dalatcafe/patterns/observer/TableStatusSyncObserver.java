package com.dalatcafe.patterns.observer;

import com.dalatcafe.dao.ITableDao;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.TableStatus;

import java.util.Objects;

public class TableStatusSyncObserver implements IOrderObserver {
    private final ITableDao tableDao;

    public TableStatusSyncObserver(ITableDao tableDao) {
        this.tableDao = Objects.requireNonNull(tableDao, "Table DAO must not be null");
    }

    @Override
    public void onOrderCompleted(Order order) {
        Objects.requireNonNull(order, "Order must not be null");
        if (order.getTableId() == null) {
            return;
        }
        if (!tableDao.updateStatus(order.getTableId(), TableStatus.CLEANING, 0)) {
            throw new IllegalStateException("Table not found: " + order.getTableId());
        }
    }
}
