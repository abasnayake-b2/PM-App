package com.nexuspm.report;

import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.field.entity.IssueFieldDefinition;
import com.nexuspm.issue.field.entity.IssueFieldValue;
import com.nexuspm.issue.field.repository.IssueFieldDefinitionRepository;
import com.nexuspm.issue.field.repository.IssueFieldValueRepository;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.project.ProjectService;
import com.nexuspm.project.entity.Project;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.report.dto.EmCapacityPlanDashboard;
import com.nexuspm.report.dto.EmCapacityPlanDashboard.EmColumn;
import com.nexuspm.report.dto.EmCapacityPlanDashboard.EmColumnTotals;
import com.nexuspm.report.dto.EmCapacityPlanDashboard.MetricCell;
import com.nexuspm.report.dto.EmCapacityPlanDashboard.MetricRow;
import com.nexuspm.report.entity.EmCapacityPlan;
import com.nexuspm.report.repository.EmCapacityPlanRepository;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.ProjectAccessScope;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.teamroster.repository.TeamManagementRepository;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.nexuspm.report.ManagementHierarchyUtils.isEngineeringManagerRole;

@Service
@RequiredArgsConstructor
public class EmCapacityPlanningService {

    private static final int DEFAULT_WEEKS = 12;
    private static final int MIN_WEEKS = 1;
    private static final int MAX_WEEKS = 52;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE;

    private static final Set<String> EXCLUDED_STATUSES = Set.of(
            "cancelled",
            "in production",
            "completed",
            "on hold",
            "onhold");

    private static final String FIELD_CR_TYPE = "cr_type";
    private static final String FIELD_MD_PLANNED = "md_planned";
    private static final String FIELD_COVERED_EXISTING = "covered_in_existing_resources";

    private final TeamManagementRepository managementRepository;
    private final ProjectRepository projectRepository;
    private final EmployeeRepository employeeRepository;
    private final RdIssueRepository issueRepository;
    private final IssueFieldValueRepository fieldValueRepository;
    private final IssueFieldDefinitionRepository fieldDefinitionRepository;
    private final EmCapacityPlanRepository capacityPlanRepository;
    private final ProjectService projectService;

    @Transactional(readOnly = true)
    public EmCapacityPlanDashboard getDashboard(Integer weeksParam) {
        if (!SecurityUtils.isManagerOrAbove()) {
            throw new BusinessException("ACCESS_DENIED", "Only managers can view capacity planning", 403);
        }

        int weeks = normalizeWeeks(weeksParam);
        LocalDate today = LocalDate.now();
        LocalDate windowFrom = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate windowTo = windowFrom.plusWeeks(weeks).minusDays(1);

        List<TeamManagement> ems = activeEngineeringManagers();
        Map<UUID, Integer> additionalByEm = loadAdditionalResources();
        Map<UUID, Integer> resourcesByEm = countExistingResourcesByEm();
        Map<UUID, Integer> projectsByEm = countProjectsByEm(ems);
        Map<UUID, EmAgg> aggByEm = aggregateIssuesByEm(ems);

        List<EmColumn> columns = new ArrayList<>();
        for (TeamManagement em : ems) {
            EmAgg agg = aggByEm.getOrDefault(em.getId(), EmAgg.empty());
            int existing = resourcesByEm.getOrDefault(em.getId(), 0);
            int additional = additionalByEm.getOrDefault(em.getId(), 0);
            int projects = projectsByEm.getOrDefault(em.getId(), 0);
            columns.add(EmColumn.builder()
                    .emId(em.getId())
                    .emName(em.getFullName())
                    .shortName(shortName(em))
                    .projectCount(projects)
                    .existingResources(existing)
                    .additionalResources(additional)
                    .notChargeableCr(agg.notChargeableCr)
                    .notChargeableEffort(round1(agg.notChargeableEffort))
                    .chargeableCr(agg.chargeableCr)
                    .chargeableEffort(round1(agg.chargeableEffort))
                    .chargeableCrByExisting(agg.chargeableCrByExisting)
                    .chargeableCrByNew(agg.chargeableCrByNew)
                    .totalCr(agg.notChargeableCr + agg.chargeableCr)
                    .totalManDays(round1(agg.notChargeableEffort + agg.chargeableEffort))
                    .build());
        }

        EmColumnTotals totals = sumTotals(columns);
        return EmCapacityPlanDashboard.builder()
                .weeks(weeks)
                .windowFrom(ISO.format(windowFrom))
                .windowTo(ISO.format(windowTo))
                .engineeringManagers(columns)
                .rows(buildMetricRows(columns, totals))
                .totals(totals)
                .build();
    }

    @Transactional
    public EmColumn updateAdditionalResources(UUID emId, int additionalResources) {
        if (!SecurityUtils.isManagerOrAbove()) {
            throw new BusinessException("ACCESS_DENIED", "Only managers can update capacity planning", 403);
        }
        TeamManagement em = managementRepository.findById(emId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Engineering manager not found", 404));
        if (!isEngineeringManagerRole(em.getRoleTitle())) {
            throw new BusinessException("VALIDATION", "Selected person is not an engineering manager", 400);
        }

        EmCapacityPlan plan = capacityPlanRepository.findByEngineeringManager_Id(emId)
                .orElseGet(() -> {
                    EmCapacityPlan created = new EmCapacityPlan();
                    created.setId(UUID.randomUUID());
                    created.setEngineeringManager(em);
                    return created;
                });
        plan.setAdditionalResources(Math.max(0, additionalResources));
        capacityPlanRepository.save(plan);

        EmCapacityPlanDashboard dashboard = getDashboard(DEFAULT_WEEKS);
        return dashboard.getEngineeringManagers().stream()
                .filter(col -> emId.equals(col.getEmId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Engineering manager not found in summary", 404));
    }

    private List<MetricRow> buildMetricRows(List<EmColumn> columns, EmColumnTotals totals) {
        List<MetricRow> rows = new ArrayList<>();
        rows.add(intRow("projectCount", "No. of Projects", false, false, columns, EmColumn::getProjectCount, totals.getProjectCount()));
        rows.add(intRow("existingResources", "No. of existing resources", false, false, columns, EmColumn::getExistingResources, totals.getExistingResources()));
        rows.add(intRow("additionalResources", "No. of additional resources", false, true, columns, EmColumn::getAdditionalResources, totals.getAdditionalResources()));
        rows.add(intRow("notChargeableCr", "Not Chargeable - CR", false, false, columns, EmColumn::getNotChargeableCr, totals.getNotChargeableCr()));
        rows.add(decimalRow("notChargeableEffort", "Not Chargeable Effort", false, columns, EmColumn::getNotChargeableEffort, totals.getNotChargeableEffort()));
        rows.add(intRow("chargeableCr", "Chargeable - CR", false, false, columns, EmColumn::getChargeableCr, totals.getChargeableCr()));
        rows.add(decimalRow("chargeableEffort", "Chargeable Effort", false, columns, EmColumn::getChargeableEffort, totals.getChargeableEffort()));
        rows.add(intRow("chargeableCrByExisting", "Chargeable - CR by existing resources", false, false, columns, EmColumn::getChargeableCrByExisting, totals.getChargeableCrByExisting()));
        rows.add(intRow("chargeableCrByNew", "Chargeable - CR by new resources", false, false, columns, EmColumn::getChargeableCrByNew, totals.getChargeableCrByNew()));
        rows.add(intRow("totalCr", "Total CR", true, false, columns, EmColumn::getTotalCr, totals.getTotalCr()));
        rows.add(decimalRow("totalManDays", "Total Man Days", true, columns, EmColumn::getTotalManDays, totals.getTotalManDays()));
        return rows;
    }

    private MetricRow intRow(
            String key,
            String label,
            boolean summary,
            boolean editable,
            List<EmColumn> columns,
            java.util.function.Function<EmColumn, Integer> getter,
            int total) {
        List<MetricCell> cells = columns.stream()
                .map(col -> {
                    int value = getter.apply(col);
                    return MetricCell.builder()
                            .emId(col.getEmId())
                            .value(value)
                            .blank(value == 0)
                            .build();
                })
                .toList();
        return MetricRow.builder()
                .key(key)
                .label(label)
                .summary(summary)
                .editable(editable)
                .values(cells)
                .total(MetricCell.builder().value(total).blank(total == 0).build())
                .build();
    }

    private MetricRow decimalRow(
            String key,
            String label,
            boolean summary,
            List<EmColumn> columns,
            java.util.function.Function<EmColumn, Double> getter,
            double total) {
        List<MetricCell> cells = columns.stream()
                .map(col -> {
                    double value = getter.apply(col);
                    return MetricCell.builder()
                            .emId(col.getEmId())
                            .value(value)
                            .blank(value == 0d)
                            .build();
                })
                .toList();
        return MetricRow.builder()
                .key(key)
                .label(label)
                .summary(summary)
                .editable(false)
                .values(cells)
                .total(MetricCell.builder().value(total).blank(total == 0d).build())
                .build();
    }

    private Map<UUID, EmAgg> aggregateIssuesByEm(List<TeamManagement> ems) {
        Map<UUID, EmAgg> result = new HashMap<>();
        for (TeamManagement em : ems) {
            result.put(em.getId(), EmAgg.empty());
        }
        if (ems.isEmpty()) {
            return result;
        }

        ProjectAccessScope scope = projectService.accessScopeForCurrentUser();
        List<UUID> scopedProjectIds = scope.admin() ? null : projectService.getAccessibleProjectIds();
        if (scopedProjectIds != null && scopedProjectIds.isEmpty()) {
            return result;
        }

        List<RdIssue> issues = issueRepository.findCapacityPlanCandidates(scopedProjectIds);
        if (issues.isEmpty()) {
            return result;
        }

        Set<UUID> issueIds = new HashSet<>();
        for (RdIssue issue : issues) {
            issueIds.add(issue.getId());
        }
        Map<UUID, Map<String, FieldVal>> fieldsByIssue = loadFieldValues(issueIds);

        for (RdIssue issue : issues) {
            if (!isChangeRequest(issue)) {
                continue;
            }
            if (isExcludedStatus(issue)) {
                continue;
            }
            TeamManagement em = issue.getProject() != null ? issue.getProject().getEngineeringManagerManagement() : null;
            if (em == null || !result.containsKey(em.getId())) {
                continue;
            }

            Map<String, FieldVal> fields = fieldsByIssue.getOrDefault(issue.getId(), Map.of());
            boolean chargeable = isChargeable(fields.get(FIELD_CR_TYPE));
            double effort = plannedManDays(fields.get(FIELD_MD_PLANNED));
            boolean coveredByExisting = isYes(fields.get(FIELD_COVERED_EXISTING));

            EmAgg agg = result.get(em.getId());
            if (chargeable) {
                agg.chargeableCr++;
                agg.chargeableEffort += effort;
                if (coveredByExisting) {
                    agg.chargeableCrByExisting++;
                } else {
                    agg.chargeableCrByNew++;
                }
            } else {
                agg.notChargeableCr++;
                agg.notChargeableEffort += effort;
            }
        }
        return result;
    }

    private Map<UUID, Map<String, FieldVal>> loadFieldValues(Set<UUID> issueIds) {
        if (issueIds.isEmpty()) {
            return Map.of();
        }
        List<String> keys = List.of(FIELD_CR_TYPE, FIELD_MD_PLANNED, FIELD_COVERED_EXISTING);
        List<IssueFieldDefinition> defs = fieldDefinitionRepository.findByFieldKeyIn(keys);
        if (defs.isEmpty()) {
            return Map.of();
        }
        Map<UUID, String> keyByDefId = new HashMap<>();
        for (IssueFieldDefinition def : defs) {
            keyByDefId.put(def.getId(), def.getFieldKey());
        }

        Map<UUID, Map<String, FieldVal>> out = new HashMap<>();
        for (IssueFieldValue value : fieldValueRepository.findByIssue_IdIn(issueIds)) {
            String key = keyByDefId.get(value.getFieldDefinition().getId());
            if (key == null) {
                continue;
            }
            out.computeIfAbsent(value.getIssue().getId(), ignored -> new HashMap<>())
                    .put(key, FieldVal.from(value));
        }
        return out;
    }

    private static boolean isChangeRequest(RdIssue issue) {
        if (issue.getIssueType() == null || issue.getIssueType().getWorkflowCode() == null) {
            return false;
        }
        String code = issue.getIssueType().getWorkflowCode().trim().toUpperCase(Locale.ROOT);
        String name = issue.getIssueType().getName() != null
                ? issue.getIssueType().getName().trim().toLowerCase(Locale.ROOT)
                : "";
        return "CHANGE".equals(code)
                || name.contains("change request")
                || name.equals("cr")
                || name.contains("amc");
    }

    private static boolean isExcludedStatus(RdIssue issue) {
        if (issue.getStatus() == null || issue.getStatus().getName() == null || issue.getStatus().getName().isBlank()) {
            return true;
        }
        String normalized = issue.getStatus().getName().trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        return EXCLUDED_STATUSES.contains(normalized) || EXCLUDED_STATUSES.contains(normalized.replace(" ", ""));
    }

    /**
     * CR Type = CR (or blank) → chargeable; CR Type = AMC → not chargeable.
     */
    private static boolean isChargeable(FieldVal crType) {
        if (crType == null || crType.text == null || crType.text.isBlank()) {
            return true;
        }
        String value = crType.text.trim().toUpperCase(Locale.ROOT);
        if (value.equals("AMC") || value.contains("AMC")) {
            return false;
        }
        return true;
    }

    private static boolean isYes(FieldVal value) {
        if (value == null) {
            return false;
        }
        if (value.bool != null) {
            return value.bool;
        }
        if (value.text == null) {
            return false;
        }
        return "yes".equalsIgnoreCase(value.text.trim());
    }

    private static double plannedManDays(FieldVal value) {
        if (value == null) {
            return 0d;
        }
        if (value.number != null) {
            return value.number.doubleValue();
        }
        if (value.text != null && !value.text.isBlank()) {
            try {
                return Double.parseDouble(value.text.trim());
            } catch (NumberFormatException ignored) {
                return 0d;
            }
        }
        return 0d;
    }

    private List<TeamManagement> activeEngineeringManagers() {
        return managementRepository.findAll().stream()
                .filter(person -> "ACTIVE".equalsIgnoreCase(person.getStatus()))
                .filter(person -> isEngineeringManagerRole(person.getRoleTitle()))
                .sorted((a, b) -> a.getFullName().compareToIgnoreCase(b.getFullName()))
                .toList();
    }

    private Map<UUID, Integer> loadAdditionalResources() {
        Map<UUID, Integer> map = new HashMap<>();
        for (EmCapacityPlan plan : capacityPlanRepository.findAll()) {
            if (plan.getEngineeringManager() != null) {
                map.put(plan.getEngineeringManager().getId(), plan.getAdditionalResources());
            }
        }
        return map;
    }

    private Map<UUID, Integer> countExistingResourcesByEm() {
        Map<UUID, Integer> map = new HashMap<>();
        for (Employee employee : employeeRepository.findActiveEngineersWithManager()) {
            if (employee.getEngineeringManagerManagement() == null) {
                continue;
            }
            UUID emId = employee.getEngineeringManagerManagement().getId();
            map.merge(emId, 1, Integer::sum);
        }
        return map;
    }

    private Map<UUID, Integer> countProjectsByEm(List<TeamManagement> ems) {
        Map<UUID, Integer> map = new HashMap<>();
        for (TeamManagement em : ems) {
            map.put(em.getId(), 0);
        }
        ProjectAccessScope scope = projectService.accessScopeForCurrentUser();
        List<UUID> scopedProjectIds = scope.admin() ? null : projectService.getAccessibleProjectIds();
        if (scopedProjectIds != null && scopedProjectIds.isEmpty()) {
            return map;
        }

        List<Project> projects = projectRepository.findActiveDetailedForMatrix(scopedProjectIds);
        for (Project project : projects) {
            TeamManagement em = project.getEngineeringManagerManagement();
            if (em != null && map.containsKey(em.getId())) {
                map.merge(em.getId(), 1, Integer::sum);
            }
        }
        return map;
    }

    private static EmColumnTotals sumTotals(List<EmColumn> columns) {
        int projectCount = 0;
        int existing = 0;
        int additional = 0;
        int notChargeableCr = 0;
        double notChargeableEffort = 0;
        int chargeableCr = 0;
        double chargeableEffort = 0;
        int byExisting = 0;
        int byNew = 0;
        for (EmColumn col : columns) {
            projectCount += col.getProjectCount();
            existing += col.getExistingResources();
            additional += col.getAdditionalResources();
            notChargeableCr += col.getNotChargeableCr();
            notChargeableEffort += col.getNotChargeableEffort();
            chargeableCr += col.getChargeableCr();
            chargeableEffort += col.getChargeableEffort();
            byExisting += col.getChargeableCrByExisting();
            byNew += col.getChargeableCrByNew();
        }
        return EmColumnTotals.builder()
                .projectCount(projectCount)
                .existingResources(existing)
                .additionalResources(additional)
                .notChargeableCr(notChargeableCr)
                .notChargeableEffort(round1(notChargeableEffort))
                .chargeableCr(chargeableCr)
                .chargeableEffort(round1(chargeableEffort))
                .chargeableCrByExisting(byExisting)
                .chargeableCrByNew(byNew)
                .totalCr(notChargeableCr + chargeableCr)
                .totalManDays(round1(notChargeableEffort + chargeableEffort))
                .build();
    }

    private static String shortName(TeamManagement em) {
        if (em.getFirstName() != null && !em.getFirstName().isBlank()) {
            return em.getFirstName().trim();
        }
        return em.getFullName();
    }

    private static int normalizeWeeks(Integer weeksParam) {
        if (weeksParam == null) {
            return DEFAULT_WEEKS;
        }
        return Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, weeksParam));
    }

    private static double round1(double value) {
        return Math.round(value * 10d) / 10d;
    }

    private static final class EmAgg {
        int notChargeableCr;
        double notChargeableEffort;
        int chargeableCr;
        double chargeableEffort;
        int chargeableCrByExisting;
        int chargeableCrByNew;

        static EmAgg empty() {
            return new EmAgg();
        }
    }

    private record FieldVal(String text, BigDecimal number, Boolean bool) {
        static FieldVal from(IssueFieldValue value) {
            return new FieldVal(value.getValueText(), value.getValueNumber(), value.getValueBool());
        }
    }
}
