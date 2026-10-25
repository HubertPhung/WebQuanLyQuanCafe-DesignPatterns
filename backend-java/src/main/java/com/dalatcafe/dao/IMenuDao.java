package com.dalatcafe.dao;

import com.dalatcafe.model.MenuItem;

import java.util.List;
import java.util.Optional;

/**
 * Interface Data Access Object cho MenuItem. Món bán hay không chỉ do công tắc in-stock; không theo
 * dõi số lượng tồn.
 */
public interface IMenuDao {
    List<MenuItem> findAll();
    Optional<MenuItem> findById(int id);
    List<MenuItem> findByCategory(String category);
    boolean save(MenuItem item);
    boolean toggleInStock(int id, boolean inStock);
    boolean deleteById(int id);
}

