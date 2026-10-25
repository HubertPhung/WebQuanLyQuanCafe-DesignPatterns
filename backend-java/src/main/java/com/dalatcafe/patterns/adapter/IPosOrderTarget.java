package com.dalatcafe.patterns.adapter;

import com.dalatcafe.model.Order;

/**
 * Interface đích (Target) của Adapter Pattern: thứ mà máy thu ngân POS mong đợi.
 */
public interface IPosOrderTarget {
    Order toPosOrder();

    int getAssignedTableId();

    String getCustomerIdentifier();
}
