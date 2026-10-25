package com.dalatcafe.dao;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Kho cài đặt trong bộ nhớ. Nó chỉ tồn tại cùng tiến trình, nên chỉ phục vụ test và chế độ
 * IN_MEMORY, nơi theo thiết kế không giữ gì qua lần khởi động lại.
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
