package com.nexuspm.shared.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Evaluates RBAC permission codes assigned via Roles &amp; access.
 * Super Admin always passes. Org leadership roles retain legacy access where
 * permissions are not yet assigned in the database.
 */
@Component("perm")
public class PermissionChecker {

    private static final Set<String> ORG_LEADERSHIP_ROLES = Set.of(
            "CXO", "VP", "MANAGER",
            "CEO", "CTO", "VP_ENG", "SR_SEM", "SEM", "TECH_LEAD");

    public boolean can(String permissionCode) {
        if (SecurityUtils.isSuperAdmin()) {
            return true;
        }
        if (SecurityUtils.hasPermission(permissionCode)) {
            return true;
        }
        return legacyOrgRoleGrant(permissionCode, currentRoleCode());
    }

    public boolean canAny(String... permissionCodes) {
        for (String code : permissionCodes) {
            if (can(code)) {
                return true;
            }
        }
        return false;
    }

    public boolean superAdmin() {
        return SecurityUtils.isSuperAdmin();
    }

    private String currentRoleCode() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof com.nexuspm.auth.security.UserPrincipal principal)) {
            return "";
        }
        return principal.getRoleCode();
    }

    private boolean legacyOrgRoleGrant(String permissionCode, String roleCode) {
        if (!ORG_LEADERSHIP_ROLES.contains(roleCode)) {
            return false;
        }
        if (permissionCode.startsWith("TEAM_")
                || permissionCode.startsWith("ORGANISATIONS_")
                || permissionCode.startsWith("ALLOCATIONS_")) {
            return true;
        }
        if (PROJECTS_CREATE.equals(permissionCode) && Set.of("CXO", "CTO", "CEO").contains(roleCode)) {
            return true;
        }
        if (PROJECTS_VIEW.equals(permissionCode) || ISSUES_VIEW.equals(permissionCode)) {
            return true;
        }
        return false;
    }

    private static final String PROJECTS_VIEW = Permissions.PROJECTS_VIEW;
    private static final String PROJECTS_CREATE = Permissions.PROJECTS_CREATE;
    private static final String ISSUES_VIEW = Permissions.ISSUES_VIEW;
}
