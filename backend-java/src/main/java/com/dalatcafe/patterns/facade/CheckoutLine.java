package com.dalatcafe.patterns.facade;

import java.util.Set;

/**
 * One requested drink: menu item, quantity and the customizations stacked on it.
 */
public final class CheckoutLine {
    private final int menuItemId;
    private final int quantity;
    private final Set<Customization> customizations;

    public CheckoutLine(int menuItemId, int quantity, Set<Customization> customizations) {
        if (menuItemId <= 0) {
            throw new IllegalArgumentException("Menu item ID must be greater than zero");
        }
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than zero");
        }
        this.menuItemId = menuItemId;
        this.quantity = quantity;
        this.customizations = customizations == null ? Set.of() : Set.copyOf(customizations);
    }

    public CheckoutLine(int menuItemId, int quantity) {
        this(menuItemId, quantity, Set.of());
    }

    public int getMenuItemId() {
        return menuItemId;
    }

    public int getQuantity() {
        return quantity;
    }

    public Set<Customization> getCustomizations() {
        return customizations;
    }
}
