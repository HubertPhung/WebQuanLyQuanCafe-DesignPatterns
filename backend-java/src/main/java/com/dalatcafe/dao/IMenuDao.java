package com.dalatcafe.dao;

import com.dalatcafe.model.MenuItem;

import java.util.List;
import java.util.Optional;

/**
 * Data Access Object interface for MenuItem. Availability is the in-stock switch only;
 * quantities are not tracked.
 */
public interface IMenuDao {
    List<MenuItem> findAll();
    Optional<MenuItem> findById(int id);
    List<MenuItem> findByCategory(String category);
    boolean save(MenuItem item);
    boolean toggleInStock(int id, boolean inStock);
    boolean deleteById(int id);
}

