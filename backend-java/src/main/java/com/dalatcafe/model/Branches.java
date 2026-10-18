package com.dalatcafe.model;

import java.util.List;

/**
 * The shop's branches. Tables, orders and reservations each belong to one branch; the menu,
 * customers and accounts are shared. Ids match {@code frontend-nextjs/lib/branches.ts}.
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

    /** Rows written before branches existed, or with a blank value, belong to the first branch. */
    public static String orDefault(String id) {
        return id == null || id.isBlank() ? DEFAULT : id;
    }
}
