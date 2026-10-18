package com.dalatcafe.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EnvFileTest {
    @TempDir
    Path dir;

    @Test
    void readsKeyValuePairsLikeTheFrontendEnvFile() throws IOException {
        Path file = dir.resolve(".env");
        Files.writeString(file, String.join("\n",
                "# Java backend settings",
                "",
                "DATABASE_URL=\"postgresql://postgres:p%40ss@db.example.co:5432/postgres?sslmode=require\"   ",
                "export AUTH_SERVICE_KEY = 'service-key-123'",
                "ADMIN_EMAIL=owner@dalatcafe.vn # trailing comment",
                "EMPTY=",
                "not a setting"), StandardCharsets.UTF_8);

        Map<String, String> values = EnvFile.read(file);

        assertEquals("postgresql://postgres:p%40ss@db.example.co:5432/postgres?sslmode=require", values.get("DATABASE_URL"));
        assertEquals("service-key-123", values.get("AUTH_SERVICE_KEY"));
        assertEquals("owner@dalatcafe.vn", values.get("ADMIN_EMAIL"));
        assertEquals("", values.get("EMPTY"));
        assertEquals(4, values.size());
    }

    @Test
    void realEnvironmentVariablesWinOverTheFile() throws IOException {
        Path file = dir.resolve(".env");
        Files.writeString(file, "AUTH_SERVICE_KEY=from-file\nADMIN_EMAIL=owner@dalatcafe.vn\n", StandardCharsets.UTF_8);

        Map<String, String> merged = EnvFile.withFile(Map.of("AUTH_SERVICE_KEY", "from-environment", "PATH", "/bin"), file);

        assertEquals("from-environment", merged.get("AUTH_SERVICE_KEY"));
        assertEquals("owner@dalatcafe.vn", merged.get("ADMIN_EMAIL"));
        assertEquals("/bin", merged.get("PATH"));
    }

    @Test
    void aMissingFileChangesNothing() {
        Map<String, String> merged = EnvFile.withFile(Map.of("PATH", "/bin"), dir.resolve("absent.env"));

        assertEquals(Map.of("PATH", "/bin"), merged);
        assertTrue(EnvFile.read(dir.resolve("absent.env")).isEmpty());
        assertFalse(merged.containsKey("AUTH_SERVICE_KEY"));
    }
}
