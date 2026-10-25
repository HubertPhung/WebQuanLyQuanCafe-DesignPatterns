package com.dalatcafe.dao;

import java.util.Map;

/**
 * Lưu các cài đặt quán do Singleton {@code SystemConfigManager} giữ dưới dạng cặp khóa-giá trị văn
 * bản, để chúng còn nguyên sau khi khởi động lại server khi dùng kho JDBC.
 */
public interface IConfigDao {
    /** Mọi cài đặt đã lưu; rỗng khi chưa lưu gì hoặc không đọc được kho lưu trữ. */
    Map<String, String> loadAll();

    /**
     * Lưu tất cả cài đặt được truyền vào cùng một lúc (thêm mới hoặc cập nhật). Trả về false khi
     * không lưu được gì.
     */
    boolean saveAll(Map<String, String> values);
}
