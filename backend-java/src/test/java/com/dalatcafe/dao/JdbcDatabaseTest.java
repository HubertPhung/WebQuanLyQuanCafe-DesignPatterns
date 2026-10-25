package com.dalatcafe.dao;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class JdbcDatabaseTest {
    private static final String PASSWORD = "s3cr3t-Passw0rd";

    @BeforeEach
    void readTheUrlFromTheSystemProperty() {
        assumeTrue(System.getenv("DATABASE_URL") == null, "a real DATABASE_URL would be used instead");
        JdbcDatabase.setCustomConnection(null, null, null);
    }

    @AfterEach
    void forgetTheUrl() {
        System.clearProperty("DATABASE_URL");
        JdbcDatabase.closePool();
    }

    @Test
    void aMalformedUrlIsReportedWithoutItsPassword() {
        System.setProperty("DATABASE_URL", "postgresql://postgres:" + PASSWORD + "@localhost:5432/my db");

        SQLException error = assertThrows(SQLException.class, JdbcDatabase::getConnection);

        assertTrue(error.getMessage().contains("DATABASE_URL"), error.getMessage());
        assertFalse(fullReport(error).contains(PASSWORD), "the password leaked into the error or its causes");
    }

    @Test
    void whitespaceAroundTheUrlIsIgnoredAndAFailedConnectionKeepsThePasswordOut() {
        // Cổng 1 từ chối ngay lập tức, nên URL được phân tích và thực sự thử kết nối.
        System.setProperty("DATABASE_URL", "  postgresql://postgres:" + PASSWORD + "@127.0.0.1:1/postgres  ");

        SQLException error = assertThrows(SQLException.class, JdbcDatabase::getConnection);

        assertFalse(error.getMessage().contains("parse"), "surrounding whitespace is not a malformed URL: " + error.getMessage());
        assertFalse(fullReport(error).contains(PASSWORD), "the password leaked into the error or its causes");
    }

    private static String fullReport(Throwable error) {
        StringWriter out = new StringWriter();
        error.printStackTrace(new PrintWriter(out));
        return out.toString();
    }
}
