package com.nexuspm.lookup;

import com.nexuspm.lookup.entity.IssueType;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class IssueTypeCatalog {

    public static final List<String> ORDERED_WORKFLOW_CODES = List.of(
            "EPIC", "STORY", "TASK", "CHANGE", "BUG");

    private IssueTypeCatalog() {
    }

    public static List<IssueType> filterAndSort(List<IssueType> issueTypes) {
        Map<String, IssueType> byCode = issueTypes.stream()
                .collect(Collectors.toMap(
                        type -> type.getWorkflowCode().toUpperCase(),
                        Function.identity(),
                        (left, right) -> left));

        return ORDERED_WORKFLOW_CODES.stream()
                .map(code -> byCode.get(code))
                .filter(type -> type != null)
                .toList();
    }

    public static boolean isAllowedWorkflowCode(String workflowCode) {
        return workflowCode != null
                && ORDERED_WORKFLOW_CODES.contains(workflowCode.trim().toUpperCase());
    }

    public static Comparator<IssueType> displayOrder() {
        return Comparator.comparingInt(type -> {
            int index = ORDERED_WORKFLOW_CODES.indexOf(type.getWorkflowCode().toUpperCase());
            return index >= 0 ? index : Integer.MAX_VALUE;
        });
    }
}
