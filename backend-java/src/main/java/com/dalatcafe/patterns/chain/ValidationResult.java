package com.dalatcafe.patterns.chain;

import java.util.Objects;

/** Immutable result of reservation validation. */
public final class ValidationResult {
    private static final ValidationResult VALID = new ValidationResult(true, null);
    private final boolean valid;
    private final String errorMessage;

    private ValidationResult(boolean valid, String errorMessage) {
        this.valid = valid;
        this.errorMessage = errorMessage;
    }

    public static ValidationResult valid() {
        return VALID;
    }

    public static ValidationResult invalid(String errorMessage) {
        Objects.requireNonNull(errorMessage, "Error message must not be null");
        if (errorMessage.isBlank()) {
            throw new IllegalArgumentException("Error message must not be blank");
        }
        return new ValidationResult(false, errorMessage);
    }

    public boolean isValid() {
        return valid;
    }

    public String getErrorMessage() {
        return errorMessage;
    }
}
