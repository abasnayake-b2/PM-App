package com.nexuspm.shared.security;

import com.nexuspm.auth.security.UserPrincipal;
import com.nexuspm.shared.exception.BusinessException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;
import java.util.UUID;

public final class SecurityUtils {

    private static final Set<String> ADMIN_ROLES = Set.of("SUPER_ADMIN", "ADMIN");
    private static final Set<String> MANAGER_ROLES = Set.of(
            "CXO", "VP", "MANAGER",
            "CTO", "VP_ENG", "SR_SEM", "SEM", "TECH_LEAD",
            "PM", "PROJECT_MANAGER", "DM", "DELIVERY_MANAGER");

    private static final Set<String> VISIBILITY_TOGGLE_ROLES = Set.of(
            "MANAGER", "SEM", "SR_SEM",
            "PM", "PROJECT_MANAGER", "DM", "DELIVERY_MANAGER",
            "VP", "VP_ENG");

    private SecurityUtils() {
    }

    public static UserPrincipal currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
            return principal;
        }
        throw new BusinessException("UNAUTHORIZED", "Not authenticated", 401);
    }

    public static UUID currentUserId() {
        return currentUser().getId();
    }

    public static String currentUserRole() {
        return currentUser().getRoleCode();
    }

    public static boolean isAdmin() {
        return ADMIN_ROLES.contains(currentUserRole());
    }

    public static boolean isManager() {
        return MANAGER_ROLES.contains(currentUserRole());
    }

    public static boolean isManagerOrAbove() {
        return isAdmin() || isManager();
    }

    public static boolean isSuperAdmin() {
        return "SUPER_ADMIN".equals(currentUserRole());
    }

    /** True when the user may see org-wide projects / team (not own-team-only). */
    public static boolean hasOrgWideVisibility() {
        if (isAdmin()) {
            return true;
        }
        String role = currentUserRole();
        if ("CXO".equals(role) || "CTO".equals(role)) {
            return true;
        }
        if (!VISIBILITY_TOGGLE_ROLES.contains(role)) {
            return false;
        }
        boolean flag = currentUser().isOrgWideVisibility();
        // VP defaults to org-wide when flag was never set false — stored value is authoritative.
        if ("VP".equals(role) || "VP_ENG".equals(role)) {
            return flag;
        }
        return flag;
    }

    public static boolean hasPermission(String permissionCode) {
        if ("SUPER_ADMIN".equals(currentUserRole())) {
            return true;
        }
        return currentUser().getPermissionCodes().contains(permissionCode);
    }
}
