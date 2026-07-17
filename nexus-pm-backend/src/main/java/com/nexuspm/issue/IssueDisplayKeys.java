package com.nexuspm.issue;

import com.nexuspm.project.entity.Project;

/**
 * Builds human-readable keys from the <strong>project name</strong>:
 * {@code SABI-GBL-RD-1}, {@code SABI-GBL-RD-1-TS-2}.
 */
public final class IssueDisplayKeys {

    private IssueDisplayKeys() {
    }

    /**
     * Key prefix from project <em>name</em> (e.g. SABI-GBL as shown in Backlog Tracker).
     * Falls back to product only if name is blank.
     */
    public static String projectKeyPrefix(Project project) {
        if (project.getName() != null && !project.getName().isBlank()) {
            return sanitize(project.getName());
        }
        if (project.getProduct() != null && !project.getProduct().isBlank()) {
            return sanitize(project.getProduct());
        }
        return "PROJ";
    }

    /** @deprecated use {@link #projectKeyPrefix(Project)} */
    public static String projectCode(Project project) {
        return projectKeyPrefix(project);
    }

    public static String rdKey(String projectPrefix, int rdNumber) {
        return projectPrefix + "-RD-" + rdNumber;
    }

    public static String childKey(String rdKey, String workflowCode, int childNumber) {
        return rdKey + "-" + childSuffix(workflowCode) + "-" + childNumber;
    }

    public static String buildDisplayKey(Project project, Integer rdNumber, Integer childNumber, String workflowCode) {
        if (rdNumber == null) {
            return null;
        }
        String rdKey = rdKey(projectKeyPrefix(project), rdNumber);
        if (childNumber == null) {
            return rdKey;
        }
        return childKey(rdKey, workflowCode, childNumber);
    }

    public static String childSuffix(String workflowCode) {
        if (workflowCode == null) {
            return "CH";
        }
        return switch (workflowCode.trim().toUpperCase()) {
            case "TASK" -> "TS";
            case "STORY" -> "ST";
            case "BUG" -> "BG";
            case "CHANGE" -> "CR";
            default -> "CH";
        };
    }

    private static String sanitize(String raw) {
        String cleaned = raw.trim().toUpperCase().replaceAll("[^A-Z0-9]+", "-");
        cleaned = cleaned.replaceAll("^-+", "").replaceAll("-+$", "");
        return cleaned.isEmpty() ? "PROJ" : cleaned;
    }
}
