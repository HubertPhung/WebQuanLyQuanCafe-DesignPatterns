package com.dalatcafe.dao;

import com.dalatcafe.model.MenuItem;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * In-memory implementation of IMenuDao using thread-safe collection.
 */
public class InMemoryMenuDao implements IMenuDao {
    private final InMemoryDatabase db;

    public InMemoryMenuDao() {
        this(InMemoryDatabase.getInstance());
    }

    public InMemoryMenuDao(InMemoryDatabase db) {
        this.db = db;
    }

    @Override
    public List<MenuItem> findAll() {
        return db.getMenuItems().values().stream()
                .sorted(Comparator.comparing(m -> m.getId() != null ? m.getId() : 0))
                .collect(Collectors.toList());
    }

    @Override
    public Optional<MenuItem> findById(int id) {
        return Optional.ofNullable(db.getMenuItems().get(id));
    }

    @Override
    public List<MenuItem> findByCategory(String category) {
        if (category == null) return new ArrayList<>();
        return db.getMenuItems().values().stream()
                .filter(m -> category.equalsIgnoreCase(m.getCategory()))
                .sorted(Comparator.comparing(m -> m.getId() != null ? m.getId() : 0))
                .collect(Collectors.toList());
    }

    @Override
    public List<MenuItem> findLowStockItems() {
        return db.getMenuItems().values().stream()
                .filter(MenuItem::isLowStock)
                .sorted(Comparator.comparingDouble(MenuItem::getStockQty))
                .collect(Collectors.toList());
    }

    @Override
    public boolean save(MenuItem item) {
        if (item == null) return false;
        if (item.getId() == null) {
            item.setId(db.generateMenuItemId());
        }
        db.getMenuItems().put(item.getId(), item);
        return true;
    }

    @Override
    public boolean updateStock(int id, double quantityChange) {
        MenuItem item = db.getMenuItems().get(id);
        if (item == null) return false;
        // The live item is shared by every request, so a change must not interleave with another.
        synchronized (item) {
            item.setStockQty(Math.max(0, item.getStockQty() + quantityChange));
        }
        return true;
    }

    @Override
    public boolean deductStockIfAvailable(int id, double quantity) {
        MenuItem item = db.getMenuItems().get(id);
        if (item == null || quantity <= 0) return false;
        synchronized (item) {
            if (item.getStockQty() < quantity) return false;
            item.setStockQty(item.getStockQty() - quantity);
        }
        return true;
    }

    @Override
    public boolean toggleInStock(int id, boolean inStock) {
        MenuItem item = db.getMenuItems().get(id);
        if (item == null) return false;
        item.setInStock(inStock);
        return true;
    }

    @Override
    public boolean deleteById(int id) {
        return db.getMenuItems().remove(id) != null;
    }
}

