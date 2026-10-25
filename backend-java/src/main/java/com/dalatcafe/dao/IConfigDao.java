package com.dalatcafe.dao;

import java.util.Map;

/**
 * Stores the store settings held by the {@code SystemConfigManager} Singleton as text key-value
 * pairs, so they survive a server restart when the JDBC store is in use.
 */
public interface IConfigDao {
    /** Every saved setting; empty when nothing was saved yet or the store cannot be read. */
    Map<String, String> loadAll();

    /** Saves all given settings together (insert or update). Returns false when nothing was saved. */
    boolean saveAll(Map<String, String> values);
}
