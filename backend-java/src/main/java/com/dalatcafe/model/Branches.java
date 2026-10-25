package com.dalatcafe.model;

import java.util.List;

/**
 * Các chi nhánh của quán. Bàn, đơn hàng và phiếu đặt bàn thuộc về một chi nhánh; thực đơn, khách
 * hàng và tài khoản dùng chung. Id khớp với {@code frontend-nextjs/lib/branches.ts}.
 */
public final class Branches {
    public static final String PHAN_DINH_PHUNG = "phan-dinh-phung";
    public static final String BUI_THI_XUAN = "bui-thi-xuan";
    public static final String DEFAULT = PHAN_DINH_PHUNG;
    public static final List<String> ALL = List.of(PHAN_DINH_PHUNG, BUI_THI_XUAN);

    private Branches() {
    }

    public static boolean isKnown(String id) {
        return id != null && ALL.contains(id);
    }

    /** Dòng ghi từ trước khi có chi nhánh, hoặc có giá trị rỗng, thuộc chi nhánh đầu tiên. */
    public static String orDefault(String id) {
        return id == null || id.isBlank() ? DEFAULT : id;
    }
}
