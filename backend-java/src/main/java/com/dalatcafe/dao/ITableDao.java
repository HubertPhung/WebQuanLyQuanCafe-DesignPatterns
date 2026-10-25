package com.dalatcafe.dao;

import com.dalatcafe.model.Table;
import com.dalatcafe.model.TableStatus;

import java.util.List;
import java.util.Optional;

/**
 * Interface Data Access Object cho thực thể Table.
 */
public interface ITableDao {
    List<Table> findAll();
    Optional<Table> findById(int id);
    List<Table> findByZone(String zone);
    List<Table> findByStatus(TableStatus status);
    boolean save(Table table);
    boolean updateStatus(int id, TableStatus status, int guestCount);
    boolean deleteById(int id);
    default boolean archiveById(int id) { return false; }
    default int nextId() { return findAll().stream().mapToInt(Table::getId).max().orElse(0) + 1; }
}

