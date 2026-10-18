package com.dalatcafe.patterns.observer;

import com.dalatcafe.dao.IOrderDao;
import com.dalatcafe.dao.ITableDao;
import com.dalatcafe.model.Order;
import com.dalatcafe.model.OrderStatus;
import com.dalatcafe.model.Table;
import com.dalatcafe.model.TableStatus;

import java.util.Objects;

/**
 * Keeps the floor plan in step with dine-in orders: a paid order seats its table (OCCUPIED),
 * and the table goes to CLEANING once the kitchen completes the order. When built with an
 * order DAO, the table stays seated while another order on it is still open.
 */
public class TableStatusSyncObserver implements IOrderObserver {
    private final ITableDao tableDao;
    private final IOrderDao orderDao;

    public TableStatusSyncObserver(ITableDao tableDao) {
        this.tableDao = Objects.requireNonNull(tableDao, "Table DAO must not be null");
        this.orderDao = null;
    }

    public TableStatusSyncObserver(ITableDao tableDao, IOrderDao orderDao) {
        this.tableDao = Objects.requireNonNull(tableDao, "Table DAO must not be null");
        this.orderDao = Objects.requireNonNull(orderDao, "Order DAO must not be null");
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
        if (order.getTableId() == null || hasOtherOpenOrder(order)) {
            return;
        }
        if (!tableDao.updateStatus(order.getTableId(), TableStatus.CLEANING, 0)) {
            throw new IllegalStateException("Table not found: " + order.getTableId());
        }
    }

    private boolean hasOtherOpenOrder(Order order) {
        if (orderDao == null) {
            return false;
        }
        return orderDao.findByTableId(order.getTableId()).stream()
                .filter(other -> !Objects.equals(other.getOrderCode(), order.getOrderCode()))
                .anyMatch(other -> other.getStatus() != OrderStatus.COMPLETED
                        && other.getStatus() != OrderStatus.CANCELLED);
    }
}
