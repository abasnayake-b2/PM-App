package com.nexuspm.ai.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexuspm.ai.AiToolCatalogService;
import com.nexuspm.ai.entity.AiToolCatalogEntry;
import com.nexuspm.issue.IssueService;
import com.nexuspm.report.CapacityUtilisationService;
import com.nexuspm.report.ReportService;
import com.nexuspm.shared.security.PermissionChecker;
import com.nexuspm.shared.security.Permissions;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Resolves Active catalog ∩ eligible pool ∩ user permissions, then executes tools.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReportTools {

    private final ReportService reportService;
    private final CapacityUtilisationService capacityUtilisationService;
    private final IssueService issueService;
    private final PermissionChecker perm;
    private final ObjectMapper objectMapper;
    private final AiToolCatalogService catalogService;
    private final EligibleToolRegistry eligibleToolRegistry;

    public record ToolSpec(
            String name,
            String displayName,
            String description,
            Map<String, Object> parametersSchema,
            String href
    ) {
    }

    public List<ToolSpec> resolveActiveToolsForCurrentUser() {
        List<AiToolCatalogEntry> active = catalogService.listActiveEntities();
        List<ToolSpec> tools = new ArrayList<>();
        for (AiToolCatalogEntry entry : active) {
            EligibleToolRegistry.EligibleTool eligible = eligibleToolRegistry.find(entry.getToolKey()).orElse(null);
            if (eligible == null) {
                continue;
            }
            if (!userMayUse(entry.getToolKey(), entry.getRequiredPermission(), eligible.defaultPermission())) {
                continue;
            }
            String description = entry.getDescription() != null && !entry.getDescription().isBlank()
                    ? entry.getDescription()
                    : eligible.defaultDescription();
            String displayName = entry.getDisplayName() != null && !entry.getDisplayName().isBlank()
                    ? entry.getDisplayName()
                    : eligible.displayName();
            tools.add(new ToolSpec(
                    entry.getToolKey(),
                    displayName,
                    description,
                    eligible.parametersSchema(),
                    hrefFor(entry.getToolKey())));
        }
        return tools;
    }

    public String execute(String toolName, String argumentsJson) {
        try {
            JsonNode args = parseArgs(argumentsJson);
            Object result = switch (toolName) {
                case EligibleToolRegistry.DASHBOARD_SUMMARY -> {
                    requireReports();
                    yield reportService.getDashboardSummary();
                }
                case EligibleToolRegistry.DASHBOARD_OVERVIEW -> {
                    requireReports();
                    yield reportService.getDashboardOverview();
                }
                case EligibleToolRegistry.CAPACITY_UTILISATION -> {
                    requireReports();
                    requireAllocations();
                    Integer weeks = args.hasNonNull("weeks") ? args.get("weeks").asInt() : null;
                    yield capacityUtilisationService.getDashboard(weeks);
                }
                case EligibleToolRegistry.ISSUES_STATUS_COUNTS -> {
                    requireIssues();
                    yield issueService.getStatusCounts(
                            uuidOrNull(args, "projectId"),
                            boolOrNull(args, "unreleasedOnly"),
                            uuidOrNull(args, "priorityId"),
                            uuidOrNull(args, "issueTypeId"));
                }
                case EligibleToolRegistry.ISSUES_CR_MATRIX -> {
                    requireIssues();
                    yield issueService.getCrStatusMatrix(uuidOrNull(args, "projectId"));
                }
                default -> Map.of("error", "Unknown tool: " + toolName);
            };
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            log.warn("AI tool {} failed: {}", toolName, e.getMessage());
            try {
                return objectMapper.writeValueAsString(Map.of(
                        "error", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
            } catch (Exception ser) {
                return "{\"error\":\"Tool execution failed\"}";
            }
        }
    }

    public List<Map<String, Object>> toOpenAiTools(List<ToolSpec> specs) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (ToolSpec spec : specs) {
            Map<String, Object> function = new LinkedHashMap<>();
            function.put("name", spec.name());
            function.put("description", spec.description());
            function.put("parameters", spec.parametersSchema());
            out.add(Map.of(
                    "type", "function",
                    "function", function
            ));
        }
        return out;
    }

    public String displayLabel(String toolKey) {
        return eligibleToolRegistry.find(toolKey)
                .map(EligibleToolRegistry.EligibleTool::displayName)
                .orElse(toolKey);
    }

    public String hrefFor(String toolKey) {
        return switch (toolKey) {
            case EligibleToolRegistry.CAPACITY_UTILISATION -> "/";
            case EligibleToolRegistry.ISSUES_STATUS_COUNTS, EligibleToolRegistry.ISSUES_CR_MATRIX -> "/issues";
            default -> "/";
        };
    }

    private boolean userMayUse(String toolKey, String requiredOverride, String defaultPermission) {
        String required = requiredOverride != null && !requiredOverride.isBlank()
                ? requiredOverride
                : defaultPermission;
        if (required != null && !required.isBlank() && !perm.can(required)) {
            return false;
        }
        // Capacity always needs report + allocation scope
        if (EligibleToolRegistry.CAPACITY_UTILISATION.equals(toolKey)) {
            return canReports() && canAllocations();
        }
        if (EligibleToolRegistry.DASHBOARD_SUMMARY.equals(toolKey)
                || EligibleToolRegistry.DASHBOARD_OVERVIEW.equals(toolKey)) {
            return canReports();
        }
        if (EligibleToolRegistry.ISSUES_STATUS_COUNTS.equals(toolKey)
                || EligibleToolRegistry.ISSUES_CR_MATRIX.equals(toolKey)) {
            return canIssues();
        }
        return true;
    }

    private boolean canReports() {
        return perm.can(Permissions.REPORTS_VIEW);
    }

    private boolean canAllocations() {
        return perm.can(Permissions.ALLOCATIONS_VIEW);
    }

    private boolean canIssues() {
        return perm.can(Permissions.ISSUES_VIEW);
    }

    private void requireReports() {
        if (!canReports()) {
            throw new IllegalStateException("Missing permission REPORTS_VIEW");
        }
    }

    private void requireAllocations() {
        if (!canAllocations()) {
            throw new IllegalStateException("Missing permission ALLOCATIONS_VIEW");
        }
    }

    private void requireIssues() {
        if (!canIssues()) {
            throw new IllegalStateException("Missing permission ISSUES_VIEW");
        }
    }

    private JsonNode parseArgs(String argumentsJson) throws Exception {
        if (argumentsJson == null || argumentsJson.isBlank()) {
            return objectMapper.createObjectNode();
        }
        return objectMapper.readTree(argumentsJson);
    }

    private static UUID uuidOrNull(JsonNode args, String field) {
        if (!args.hasNonNull(field)) {
            return null;
        }
        String raw = args.get(field).asText();
        if (raw.isBlank()) {
            return null;
        }
        return UUID.fromString(raw);
    }

    private static Boolean boolOrNull(JsonNode args, String field) {
        if (!args.has(field) || args.get(field).isNull()) {
            return null;
        }
        return args.get(field).asBoolean();
    }
}
