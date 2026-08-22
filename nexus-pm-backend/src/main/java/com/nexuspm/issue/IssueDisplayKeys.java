package com.nexuspm.issue;

import com.nexuspm.project.entity.Project;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Builds human-readable keys from the <strong>project name</strong>:
 * {@code SABI-GBL-RD-1}, {@code SABI-GBL-RD-1-TS-2}.
 */
public final class IssueDisplayKeys {

    private static final Pattern KEYED_RD_NUMBER = Pattern.compile("(?i)-RD-(\\d+)$");

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

    /**
     * Reads the RD sequence from Excel CR # (or a full key like {@code SABI-GBL-RD-9}).
     * Blank / non-numeric values return {@code null} so the allocator can use the next number.
     */
    public static Integer parseExcelRdNumber(String crNumber) {
        if (crNumber == null || crNumber.isBlank()) {
            return null;
        }
        String raw = crNumber.trim();
        Matcher keyed = KEYED_RD_NUMBER.matcher(raw);
        if (keyed.find()) {
            return toPositiveInt(keyed.group(1));
        }
        if (raw.matches("\\d+(\\.0+)?")) {
            int dot = raw.indexOf('.');
            return toPositiveInt(dot < 0 ? raw : raw.substring(0, dot));
        }
        String digits = raw.replaceAll("[^0-9]", "");
        String letters = raw.replaceAll("[^A-Za-z]", "");
        if (digits.isEmpty()) {
            return null;
        }
        if (letters.isEmpty()
                || letters.equalsIgnoreCase("CR")
                || letters.equalsIgnoreCase("CRNO")
                || letters.equalsIgnoreCase("CRNUM")
                || letters.equalsIgnoreCase("CRNUMBER")) {
            return toPositiveInt(digits);
        }
        return null;
    }

    private static Integer toPositiveInt(String raw) {
        try {
            long value = Long.parseLong(raw);
            if (value < 1 || value > Integer.MAX_VALUE) {
                return null;
            }
            return (int) value;
        } catch (NumberFormatException e) {
            return null;
        }
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
