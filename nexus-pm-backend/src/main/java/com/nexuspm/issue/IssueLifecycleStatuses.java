package com.nexuspm.issue;

public final class IssueLifecycleStatuses {

    public static final String DEFAULT_STATUS = "Requirements Initiated";

    private IssueLifecycleStatuses() {
    }

    public static boolean isTerminalStatusName(String statusName) {
        if (statusName == null) {
            return false;
        }
        String normalized = statusName.trim().toLowerCase();
        return normalized.equals("completed")
                || normalized.equals("cancelled")
                || normalized.equals("on hold");
    }
}
