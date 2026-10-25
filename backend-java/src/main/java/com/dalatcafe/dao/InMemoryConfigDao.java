package com.dalatcafe.dao;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * In-memory settings store. It lives as long as the process, so it only helps tests and the
 * IN_MEMORY mode, where nothing is kept across restarts by design.
 */
public class InMemoryConfigDao implements IConfigDao {
    private final Map<String, String> values = new LinkedHashMap<>();

    @Override
    public synchronized Map<String, String> loadAll() {
        return new LinkedHashMap<>(values);
    }

    @Override
    public synchronized boolean saveAll(Map<String, String> toSave) {
        Objects.requireNonNull(toSave, "Values must not be null");
        values.putAll(toSave);
        return true;
    }
}
