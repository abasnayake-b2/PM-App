package com.nexuspm.user;

/** Roster / management people counted in org views and grids. */
public final class ActiveRosterStatus {

    private ActiveRosterStatus() {
    }

    public static boolean isActive(String status) {
        return status == null || status.isBlank() || "ACTIVE".equalsIgnoreCase(status.trim());
    }
}
