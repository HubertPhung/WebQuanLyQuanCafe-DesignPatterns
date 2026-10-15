package com.dalatcafe.dao;

import com.dalatcafe.model.Table;
import com.dalatcafe.model.TableStatus;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * In-memory implementation of ITableDao using thread-safe collection.
 */
public class InMemoryTableDao implements ITableDao {
    private final InMemoryDatabase db;

    public InMemoryTableDao() {
        this(InMemoryDatabase.getInstance());
    }

    public InMemoryTableDao(InMemoryDatabase db) {
        this.db = db;
    }

    @Override
    public List<Table> findAll() {
        return db.getTables().values().stream()
                .sorted(Comparator.comparingInt(Table::getId))
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Table> findById(int id) {
        return Optional.ofNullable(db.getTables().get(id));
    }

    @Override
    public List<Table> findByZone(String zone) {
        if (zone == null) return new ArrayList<>();
        return db.getTables().values().stream()
                .filter(t -> zone.equalsIgnoreCase(t.getZone()))
                .sorted(Comparator.comparingInt(Table::getId))
                .collect(Collectors.toList());
    }

    @Override
    public List<Table> findByStatus(TableStatus status) {
        if (status == null) return new ArrayList<>();
        return db.getTables().values().stream()
                .filter(t -> t.getStatus() == status)
                .sorted(Comparator.comparingInt(Table::getId))
                .collect(Collectors.toList());
    }

    @Override
    public boolean save(Table table) {
        if (table == null) return false;
        db.getTables().put(table.getId(), table);
        return true;
    }

    @Override
    public boolean updateStatus(int id, TableStatus status, int guestCount) {
        Table table = db.getTables().get(id);
        if (table == null) return false;
        table.setStatus(status);
        table.setGuestCount(guestCount);
        return true;
    }

    @Override
    public boolean deleteById(int id) {
        return db.getTables().remove(id) != null;
    }
}
