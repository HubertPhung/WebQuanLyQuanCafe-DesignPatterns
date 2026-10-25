package com.dalatcafe.util;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Đọc file {@code .env} (mỗi dòng KEY=VALUE, giống .env.local của frontend) để server khởi động
 * được mà không cần export DATABASE_URL, AUTH_SERVICE_KEY hay ADMIN_* bằng tay. Biến môi trường
 * thật luôn được ưu tiên hơn file. File chứa thông tin bí mật và bị git bỏ qua.
 */
public final class EnvFile {
    private static final Pattern LINE = Pattern.compile("^\\s*(?:export\\s+)?([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*(.*)$");

    private EnvFile() {
    }

    /** Các cài đặt trong {@code file}; rỗng khi file không tồn tại hoặc không đọc được. */
    public static Map<String, String> read(Path file) {
        Map<String, String> values = new LinkedHashMap<>();
        if (!Files.isRegularFile(file)) {
            return values;
        }
        try {
            for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                if (line.isBlank() || line.stripLeading().startsWith("#")) {
                    continue;
                }
                Matcher match = LINE.matcher(line);
                if (match.matches()) {
                    values.put(match.group(1), value(match.group(2).strip()));
                }
            }
        } catch (IOException e) {
            return new LinkedHashMap<>();
        }
        return values;
    }

    /** {@code environment} cộng thêm các cài đặt trong {@code file} mà nó chưa định nghĩa. */
    public static Map<String, String> withFile(Map<String, String> environment, Path file) {
        Map<String, String> merged = new HashMap<>(read(file));
        merged.putAll(environment);
        return merged;
    }

    private static String value(String raw) {
        if (raw.length() >= 2 && (raw.charAt(0) == '"' || raw.charAt(0) == '\'')) {
            int end = raw.indexOf(raw.charAt(0), 1);
            if (end > 0) {
                return raw.substring(1, end);
            }
        }
        int comment = raw.indexOf(" #");
        return (comment >= 0 ? raw.substring(0, comment) : raw).strip();
    }
}
