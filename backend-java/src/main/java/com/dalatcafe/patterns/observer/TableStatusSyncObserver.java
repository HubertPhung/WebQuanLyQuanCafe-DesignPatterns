package com.dalatcafe.patterns.observer;

import com.dalatcafe.dao.ITableDao;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.Table;
import com.dalatcafe.model.TableStatus;

import java.util.Objects;

/**
 * Keeps the floor plan in step with dine-in orders: a paid order seats its table (OCCUPIED),
 * and the table goes to CLEANING once the kitchen completes the order.
 */
public class TableStatusSyncObserver implements IOrderObserver {
    private final ITableDao tableDao;

    public TableStatusSyncObserver(ITableDao tableDao) {
        this.tableDao = Objects.requireNonNull(tableDao, "Table DAO must not be null");
    }

    @Override
    public void onOrderPaid(Order order) {
        Objects.requireNonNull(order, "Order must not be null");
        if (order.getTableId() == null) {
            return;
        }
        Table table = tableDao.findById(order.getTableId())
                .orElseThrow(() -> new IllegalStateException("Table not found: " + order.getTableId()));
        int guests = Math.max(1, table.getGuestCount());
        tableDao.updateStatus(table.getId(), TableStatus.OCCUPIED, guests);
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
