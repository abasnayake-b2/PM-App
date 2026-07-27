package com.nexuspm.ai.tools;

import com.nexuspm.shared.security.Permissions;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Code-defined eligible tool pool. Admin Add picks from here into ai_tool_catalog (Active).
 */
@Component
public class EligibleToolRegistry {

    public static final String DASHBOARD_SUMMARY = "dashboard.summary";
    public static final String DASHBOARD_OVERVIEW = "dashboard.overview";
    public static final String CAPACITY_UTILISATION = "capacity.utilisation";
    public static final String ISSUES_STATUS_COUNTS = "issues.statusCounts";
    public static final String ISSUES_CR_MATRIX = "issues.crMatrix";

    public record EligibleTool(
            String toolKey,
            String displayName,
            String defaultDescription,
            String defaultPermission,
            String apiPath,
            Map<String, Object> parametersSchema
    ) {
    }

    private final Map<String, EligibleTool> byKey;

    public EligibleToolRegistry() {
        Map<String, EligibleTool> map = new LinkedHashMap<>();
        put(map, new EligibleTool(
                DASHBOARD_SUMMARY,
                "Dashboard summary",
                "Get high-level dashboard summary metrics for the current user's scoped projects "
                        + "(counts, status rollups). Use for quick totals and overview numbers.",
                Permissions.REPORTS_VIEW,
                "GET /reports/dashboard",
                emptyObjectSchema()));
        put(map, new EligibleTool(
                DASHBOARD_OVERVIEW,
                "Dashboard overview",
                "Get detailed dashboard overview including project breakdowns and resource highlights "
                        + "for the current user's scope.",
                Permissions.REPORTS_VIEW,
                "GET /reports/dashboard/overview",
                emptyObjectSchema()));
        put(map, new EligibleTool(
                CAPACITY_UTILISATION,
                "Capacity utilisation",
                "Get capacity utilisation dashboard for engineers over a week horizon. "
                        + "Use for over-allocation, under-utilisation, and who is busy in the next N weeks. "
                        + "Optional argument: weeks (integer 1-52, default 12).",
                Permissions.ALLOCATIONS_VIEW,
                "GET /reports/dashboard/capacity-utilisation",
                Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "weeks", Map.of(
                                        "type", "integer",
                                        "description", "Number of weeks ahead to analyse (1-52). Default 12."
                                )
                        )
                )));
        put(map, new EligibleTool(
                ISSUES_STATUS_COUNTS,
                "Issue status counts",
                "Get issue status counts, optionally filtered by project, unreleased-only, priority, or type.",
                Permissions.ISSUES_VIEW,
                "GET /issues/status-counts",
                Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "projectId", Map.of("type", "string", "description", "Optional project UUID"),
                                "unreleasedOnly", Map.of("type", "boolean", "description", "If true, only unreleased issues"),
                                "priorityId", Map.of("type", "string", "description", "Optional priority UUID"),
                                "issueTypeId", Map.of("type", "string", "description", "Optional issue type UUID")
                        )
                )));
        put(map, new EligibleTool(
                ISSUES_CR_MATRIX,
                "CR status matrix",
                "Get Change Request (CR) status matrix, optionally for one project.",
                Permissions.ISSUES_VIEW,
                "GET /issues/cr-status-matrix",
                Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "projectId", Map.of("type", "string", "description", "Optional project UUID")
                        )
                )));
        this.byKey = Map.copyOf(map);
    }

    public Collection<EligibleTool> all() {
        return byKey.values();
    }

    public Optional<EligibleTool> find(String toolKey) {
        return Optional.ofNullable(byKey.get(toolKey));
    }

    public boolean isKnown(String toolKey) {
        return byKey.containsKey(toolKey);
    }

    public List<EligibleTool> availableMinus(Collection<String> activeKeys) {
        return byKey.values().stream()
                .filter(t -> !activeKeys.contains(t.toolKey()))
                .toList();
    }

    private static void put(Map<String, EligibleTool> map, EligibleTool tool) {
        map.put(tool.toolKey(), tool);
    }

    private static Map<String, Object> emptyObjectSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of()
        );
    }
}
