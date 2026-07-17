package com.nexuspm.shared.security;

import java.util.List;
import java.util.UUID;

/**
 * Resolved project visibility for the current user based on org role and management hierarchy.
 */
public record ProjectAccessScope(
        UUID employeeId,
        UUID teamManagementId,
        String managerFullName,
        boolean admin,
        boolean engineeringPortfolioWide,
        boolean vpEmScope,
        List<UUID> emManagementIds
) {
    public static ProjectAccessScope admin(UUID employeeId) {
        return new ProjectAccessScope(
                employeeId,
                null,
                null,
                true,
                false,
                false,
                List.of(OrgAccessScopeService.EMPTY_EM_SCOPE_ID));
    }

    public boolean hasVpEmScope() {
        return vpEmScope && emManagementIds != null && !emManagementIds.isEmpty();
    }
}
