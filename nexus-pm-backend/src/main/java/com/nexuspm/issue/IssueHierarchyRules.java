package com.nexuspm.issue;

import com.nexuspm.lookup.IssueTypeCatalog;

import java.util.List;
import java.util.Map;
import java.util.Set;

public final class IssueHierarchyRules {

    private static final Map<String, Set<String>> ALLOWED_CHILDREN = Map.of(
            "EPIC", Set.of("STORY", "TASK", "BUG", "CHANGE"),
            "STORY", Set.of("TASK", "BUG"));

    private IssueHierarchyRules() {
    }

    public static boolean canHaveChildren(String parentWorkflowCode) {
        if (parentWorkflowCode == null) {
            return false;
        }
        return ALLOWED_CHILDREN.containsKey(parentWorkflowCode.trim().toUpperCase());
    }

    public static boolean isValidChild(String parentWorkflowCode, String childWorkflowCode) {
        if (parentWorkflowCode == null || childWorkflowCode == null) {
            return false;
        }
        Set<String> allowed = ALLOWED_CHILDREN.get(parentWorkflowCode.trim().toUpperCase());
        return allowed != null && allowed.contains(childWorkflowCode.trim().toUpperCase());
    }

    public static List<String> orderedChildWorkflowCodes(String parentWorkflowCode) {
        if (!canHaveChildren(parentWorkflowCode)) {
            return List.of();
        }
        Set<String> allowed = ALLOWED_CHILDREN.get(parentWorkflowCode.trim().toUpperCase());
        return IssueTypeCatalog.ORDERED_WORKFLOW_CODES.stream()
                .filter(allowed::contains)
                .toList();
    }
}
