package com.nexuspm.risk;

import com.nexuspm.shared.exception.BusinessException;

import java.time.LocalDate;
import java.util.Set;

public final class RiskValidation {

    private static final Set<String> STATUSES = Set.of("Open", "Closed", "Hold", "Rejected");
    private static final Set<String> IMPACTS = Set.of("Low", "Mid", "High");

    private RiskValidation() {
    }

    public static void validateDates(LocalDate created, LocalDate closed) {
        if (created != null && closed != null && closed.isBefore(created)) {
            throw new BusinessException(
                    "VALIDATION",
                    "Risk Closed Date cannot be before Risk Created Date",
                    400);
        }
    }

    public static void validateStatus(String status) {
        if (status == null || status.isBlank()) {
            return;
        }
        if (!STATUSES.contains(status.trim())) {
            throw new BusinessException(
                    "VALIDATION",
                    "Risk Status must be one of: Open, Closed, Hold, Rejected",
                    400);
        }
    }

    public static void validateImpact(String impact) {
        if (impact == null || impact.isBlank()) {
            return;
        }
        if (!IMPACTS.contains(impact.trim())) {
            throw new BusinessException(
                    "VALIDATION",
                    "Risk Impact must be one of: Low, Mid, High",
                    400);
        }
    }

    public static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
