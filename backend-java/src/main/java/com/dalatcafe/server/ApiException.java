package com.dalatcafe.server;

/**
 * Lỗi nghiệp vụ/kiểm tra dữ liệu, mang mã HTTP và mã lỗi chuẩn theo docs/API_SPEC.md mục 1.3.
 */
public class ApiException extends RuntimeException {
    private final int status;
    private final String code;

    public ApiException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public static ApiException badRequest(String message) {
        return new ApiException(400, "INVALID_INPUT", message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(404, "NOT_FOUND", message);
    }
}
