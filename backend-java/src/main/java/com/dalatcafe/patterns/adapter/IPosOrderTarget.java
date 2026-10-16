package com.dalatcafe.patterns.adapter;

import com.dalatcafe.model.Order;

/**
 * Target interface of the Adapter Pattern: what the POS cashier terminal expects.
 */
public interface IPosOrderTarget {
    Order toPosOrder();

    int getAssignedTableId();

    String getCustomerIdentifier();
}
