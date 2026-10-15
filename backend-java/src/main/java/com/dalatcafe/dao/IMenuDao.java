package com.dalatcafe.dao;

import com.dalatcafe.model.MenuItem;

import java.util.List;
import java.util.Optional;

/**
 * Data Access Object interface for MenuItem & Inventory entity.
 */
public interface IMenuDao {
    List<MenuItem> findAll();
    Optional<MenuItem> findById(int id);
    List<MenuItem> findByCategory(String category);
    List<MenuItem> findLowStockItems();
    boolean save(MenuItem item);
    boolean updateStock(int id, double quantityChange);
    boolean toggleInStock(int id, boolean inStock);
    boolean deleteById(int id);
}

