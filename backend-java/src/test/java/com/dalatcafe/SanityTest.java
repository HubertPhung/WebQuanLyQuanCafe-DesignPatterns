package com.dalatcafe;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Hệ thống Backend Java SE Sanity Test")
public class SanityTest {

    @Test
    @DisplayName("Khởi tạo môi trường Java SE 17+ và JUnit 5 thành công")
    void testJavaEnvironment() {
        int javaMajorVersion = Runtime.version().feature();
        assertTrue(javaMajorVersion >= 17, "Môi trường Java Runtime phải từ 17 trở lên (Hiện tại: " + javaMajorVersion + ")");
    }
}

