package com.dalatcafe.dao;

import com.dalatcafe.model.MenuItem;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Bản cài đặt IMenuDao trong bộ nhớ, dùng collection an toàn đa luồng.
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
    public boolean save(MenuItem item) {
        if (item == null) return false;
        if (item.getId() == null) {
            item.setId(db.generateMenuItemId());
        }
        db.getMenuItems().put(item.getId(), item);
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

