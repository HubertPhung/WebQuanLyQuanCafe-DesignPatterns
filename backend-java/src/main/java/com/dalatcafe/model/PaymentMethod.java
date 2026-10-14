package com.dalatcafe.model;

/**
 * Accepted payment methods at Đà Lạt Cafe.
 */
public enum PaymentMethod {
    CASH("Tiền mặt"),
    QR("Chuyển khoản QR (MoMo / VNPay)"),
    CARD("Quẹt thẻ ngân hàng (POS Card)");

    private final String description;

    PaymentMethod(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}

