package com.nexuspm.issue;

import com.nexuspm.admin.repository.WorkflowRuleRepository;
import com.nexuspm.issue.dto.*;
import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.field.IssueCustomFieldService;
import com.nexuspm.issue.field.entity.IssueFieldDefinition;
import com.nexuspm.issue.field.entity.IssueFieldValue;
import com.nexuspm.issue.field.repository.IssueFieldDefinitionRepository;
import com.nexuspm.issue.field.repository.IssueFieldValueRepository;
import com.nexuspm.issue.mapper.IssueMapper;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.lookup.IssueTypeCatalog;
import com.nexuspm.lookup.entity.IssueStatus;
import com.nexuspm.lookup.entity.IssueType;
import com.nexuspm.lookup.entity.Priority;
import com.nexuspm.lookup.repository.IssueStatusRepository;
import com.nexuspm.lookup.repository.IssueTypeRepository;
import com.nexuspm.lookup.repository.PriorityRepository;
import com.nexuspm.project.ProjectService;
import com.nexuspm.project.entity.Project;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.release.entity.Release;
import com.nexuspm.release.repository.ReleaseRepository;
import com.nexuspm.resource.entity.Allocation;
import com.nexuspm.resource.repository.AllocationRepository;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.shared.softdelete.SoftDeleteService;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IssueService {

    private final RdIssueRepository issueRepository;
    private final ReleaseRepository releaseRepository;
    private final ProjectRepository projectRepository;
    private final IssueTypeRepository issueTypeRepository;
    private final PriorityRepository priorityRepository;
    private final IssueStatusRepository issueStatusRepository;
    private final EmployeeRepository employeeRepository;
    private final ProjectService projectService;
    private final IssueMapper issueMapper;
    private final IssueKeyAllocator issueKeyAllocator;
    private final AuditLogService auditLogService;
    private final WorkflowRuleRepository workflowRuleRepository;
    private final AllocationRepository allocationRepository;
    private final SoftDeleteService softDeleteService;
    private final IssueCustomFieldService customFieldService;
    private final BacklogExcelExportService backlogExcelExportService;
    private final IssueFieldDefinitionRepository fieldDefinitionRepository;
    private final IssueFieldValueRepository fieldValueRepository;

    @Transactional(readOnly = true)
    public Page<IssueResponse> listIssues(
            UUID releaseId,
            UUID projectId,
            Boolean unreleasedOnly,
            UUID statusId,
            List<UUID> statusIds,
            String slaStatus,
            UUID assignedToId,
            UUID priorityId,
            UUID issueTypeId,
            String q,
            Pageable pageable) {
        verifyListAccess(releaseId, projectId);
        List<UUID> scopedProjectIds = resolveScopedProjectIds(projectId, releaseId);
        if (scopedProjectIds != null && scopedProjectIds.isEmpty()) {
            return Page.empty(pageable);
        }
        List<UUID> resolvedStatusIds = resolveStatusFilter(statusId, statusIds);
        boolean filterByStatusIds = resolvedStatusIds != null && !resolvedStatusIds.isEmpty();
        String search = normalizeSearch(q);
        String idHint = extractIssueIdHint(search);
        boolean hasSearch = search != null;
        boolean hasIdHint = idHint != null;
        String searchPattern = hasSearch ? "%" + escapeLike(search.toLowerCase()) + "%" : "%";
        // Display keys like IX-8130 are the last 4 hex chars of the UUID (no dashes).
        String idHintPattern = hasIdHint
                ? (idHint.length() <= 4 ? "%" + idHint.toLowerCase() : "%" + idHint.toLowerCase() + "%")
                : "%";
        // Also match dashed UUID text (…-xxxx-xxxx8130 etc.).
        String idHintDashedPattern = hasIdHint ? "%" + idHint.toLowerCase() + "%" : "%";
        Page<IssueResponse> page = issueRepository.search(
                        releaseId,
                        projectId,
                        scopedProjectIds,
                        Boolean.TRUE.equals(unreleasedOnly),
                        filterByStatusIds,
                        filterByStatusIds ? resolvedStatusIds : List.of(),
                        slaStatus,
                        assignedToId,
                        priorityId,
                        issueTypeId,
                        hasSearch,
                        searchPattern,
                        hasIdHint,
                        idHintPattern,
                        idHintDashedPattern,
                        pageable)
                .map(issueMapper::toResponse);
        enrichWithAllocations(page.getContent());
        enrichWithCustomFields(page.getContent());
        return page;
    }

    /**
     * Full-set status counts for the RD overview board — independent of grid pagination.
     * Ignores status filters so every stage remains visible with totals.
     */
    @Transactional(readOnly = true)
    public IssueStatusCountsResponse getStatusCounts(
            UUID projectId,
            Boolean unreleasedOnly,
            UUID priorityId,
            UUID issueTypeId) {
        verifyListAccess(null, projectId);
        List<UUID> scopedProjectIds = resolveScopedProjectIds(projectId, null);
        if (scopedProjectIds != null && scopedProjectIds.isEmpty()) {
            return IssueStatusCountsResponse.builder()
                    .countsByStatusId(Map.of())
                    .total(0)
                    .build();
        }

        Map<UUID, Long> counts = new LinkedHashMap<>();
        long total = 0;
        for (Object[] row : issueRepository.countByStatusFiltered(
                projectId,
                scopedProjectIds,
                Boolean.TRUE.equals(unreleasedOnly),
                priorityId,
                issueTypeId)) {
            UUID statusId = (UUID) row[0];
            long count = ((Number) row[1]).longValue();
            counts.put(statusId, count);
            total += count;
        }
        return IssueStatusCountsResponse.builder()
                .countsByStatusId(counts)
                .total(total)
                .build();
    }

    private void enrichWithCustomFields(List<IssueResponse> issues) {
        if (issues.isEmpty()) {
            return;
        }
        List<UUID> ids = issues.stream().map(IssueResponse::getId).toList();
        Map<UUID, Map<String, String>> byIssue = customFieldService.loadValuesAsMaps(ids);
        for (IssueResponse issue : issues) {
            issue.setCustomFields(byIssue.getOrDefault(issue.getId(), Map.of()));
        }
    }

    /**
     * Excel export for Main Backlog: Summary sheet + one sheet per project with RD/CR detail rows.
     * Respects the same filters/scoping as {@link #listIssues}. Top-level items only (no children).
     */
    @Transactional(readOnly = true)
    public byte[] exportBacklogExcel(
            UUID projectId,
            UUID statusId,
            List<UUID> statusIds,
            UUID priorityId,
            UUID issueTypeId,
            String q) throws IOException {
        verifyListAccess(null, projectId);
        List<UUID> scopedProjectIds = resolveScopedProjectIds(projectId, null);
        if (scopedProjectIds != null && scopedProjectIds.isEmpty()) {
            return backlogExcelExportService.export(List.of(), issueStatusRepository.findAllByOrderBySequenceAsc(), Map.of());
        }

        List<UUID> resolvedStatusIds = resolveStatusFilter(statusId, statusIds);
        boolean filterByStatusIds = resolvedStatusIds != null && !resolvedStatusIds.isEmpty();
        String search = normalizeSearch(q);
        String idHint = extractIssueIdHint(search);
        boolean hasSearch = search != null;
        boolean hasIdHint = idHint != null;
        String searchPattern = hasSearch ? "%" + escapeLike(search.toLowerCase()) + "%" : "%";
        String idHintPattern = hasIdHint
                ? (idHint.length() <= 4 ? "%" + idHint.toLowerCase() : "%" + idHint.toLowerCase() + "%")
                : "%";
        String idHintDashedPattern = hasIdHint ? "%" + idHint.toLowerCase() + "%" : "%";

        List<RdIssue> issues = issueRepository.findTopLevelForExport(
                projectId,
                scopedProjectIds,
                filterByStatusIds,
                filterByStatusIds ? resolvedStatusIds : List.of(),
                priorityId,
                issueTypeId,
                hasSearch,
                searchPattern,
                hasIdHint,
                idHintPattern,
                idHintDashedPattern);

        Map<UUID, Map<String, BacklogExcelExportService.FieldVal>> fieldsByIssue =
                loadExportFieldValues(issues.stream().map(RdIssue::getId).toList());
        List<IssueStatus> statuses = issueStatusRepository.findAllByOrderBySequenceAsc();
        return backlogExcelExportService.export(issues, statuses, fieldsByIssue);
    }

    private Map<UUID, Map<String, BacklogExcelExportService.FieldVal>> loadExportFieldValues(List<UUID> issueIds) {
        if (issueIds.isEmpty()) {
            return Map.of();
        }
        List<String> keys = List.of(BacklogExcelExportService.fieldKeys());
        List<IssueFieldDefinition> defs = fieldDefinitionRepository.findByFieldKeyIn(keys);
        if (defs.isEmpty()) {
            return Map.of();
        }
        Map<UUID, String> keyByDefId = new HashMap<>();
        for (IssueFieldDefinition def : defs) {
            keyByDefId.put(def.getId(), def.getFieldKey());
        }

        Map<UUID, Map<String, BacklogExcelExportService.FieldVal>> out = new HashMap<>();
        final int batchSize = 500;
        for (int i = 0; i < issueIds.size(); i += batchSize) {
            List<UUID> batch = issueIds.subList(i, Math.min(i + batchSize, issueIds.size()));
            for (IssueFieldValue value : fieldValueRepository.findByIssue_IdIn(batch)) {
                String key = keyByDefId.get(value.getFieldDefinition().getId());
                if (key == null) {
                    continue;
                }
                out.computeIfAbsent(value.getIssue().getId(), ignored -> new HashMap<>())
                        .put(key, BacklogExcelExportService.FieldVal.from(value));
            }
        }
        return out;
    }

    /**
     * EM × status pivot for Backlog Tracker matrix tab — one row per project.
     */
    @Transactional(readOnly = true)
    public CrStatusMatrixResponse getCrStatusMatrix(UUID projectId) {
        verifyListAccess(null, projectId);
        List<UUID> scopedProjectIds = resolveScopedProjectIds(projectId, null);
        if (scopedProjectIds != null && scopedProjectIds.isEmpty()) {
            return emptyMatrix();
        }
        if (projectId != null) {
            scopedProjectIds = List.of(projectId);
        }

        List<IssueStatus> statuses = issueStatusRepository.findAllByOrderBySequenceAsc();
        List<CrStatusMatrixResponse.StatusColumn> statusColumns = statuses.stream()
                .map(s -> CrStatusMatrixResponse.StatusColumn.builder()
                        .id(s.getId())
                        .name(s.getName())
                        .sequence(s.getSequence())
                        .terminal(s.isTerminal())
                        .colour(s.getColour())
                        .build())
                .toList();

        Map<UUID, Map<UUID, Long>> countsByProject = new HashMap<>();
        for (Object[] row : issueRepository.countByProjectAndStatus(scopedProjectIds)) {
            UUID pid = (UUID) row[0];
            UUID statusId = (UUID) row[1];
            long count = ((Number) row[2]).longValue();
            countsByProject.computeIfAbsent(pid, k -> new HashMap<>()).put(statusId, count);
        }

        Map<UUID, Long> totalByProject = toCountMap(issueRepository.countTotalsByProject(scopedProjectIds));
        Map<UUID, Long> activeByProject = toCountMap(issueRepository.countActiveByProject(scopedProjectIds));

        List<Project> projects = projectRepository.findActiveDetailedForMatrix(scopedProjectIds);
        List<CrStatusMatrixResponse.MatrixRow> rows = new ArrayList<>();
        Map<UUID, Long> grandStatus = new LinkedHashMap<>();
        for (IssueStatus status : statuses) {
            grandStatus.put(status.getId(), 0L);
        }
        long grandTotal = 0;
        long grandActive = 0;

        for (Project project : projects) {
            Map<UUID, Long> statusCounts = countsByProject.getOrDefault(project.getId(), Map.of());
            Map<UUID, Long> fullCounts = new LinkedHashMap<>();
            for (IssueStatus status : statuses) {
                long c = statusCounts.getOrDefault(status.getId(), 0L);
                fullCounts.put(status.getId(), c);
                grandStatus.merge(status.getId(), c, Long::sum);
            }
            long total = totalByProject.getOrDefault(project.getId(), 0L);
            if (total == 0) {
                continue;
            }
            long active = activeByProject.getOrDefault(project.getId(), 0L);
            grandTotal += total;
            grandActive += active;

            var client = project.getClient();
            var country = client != null ? client.getCountry() : null;
            var em = project.getEngineeringManagerManagement();
            var architect = project.getArchitectEmployee();
            var lead = project.getLeadEmployee();

            rows.add(CrStatusMatrixResponse.MatrixRow.builder()
                    .projectId(project.getId())
                    .projectName(project.getName())
                    .emName(em != null ? em.getFullName() : null)
                    .architectName(employeeFullName(architect))
                    .countryName(country != null ? country.getName() : null)
                    .clientName(client != null ? client.getName() : null)
                    .product(project.getProduct())
                    .pmName(employeeFullName(lead))
                    .dmName(null)
                    .totalCr(total)
                    .activeCr(active)
                    .statusCounts(fullCounts)
                    .build());
        }

        return CrStatusMatrixResponse.builder()
                .statuses(statusColumns)
                .rows(rows)
                .totals(CrStatusMatrixResponse.MatrixTotals.builder()
                        .totalCr(grandTotal)
                        .activeCr(grandActive)
                        .statusCounts(grandStatus)
                        .build())
                .build();
    }

    private CrStatusMatrixResponse emptyMatrix() {
        List<CrStatusMatrixResponse.StatusColumn> statusColumns = issueStatusRepository
                .findAllByOrderBySequenceAsc()
                .stream()
                .map(s -> CrStatusMatrixResponse.StatusColumn.builder()
                        .id(s.getId())
                        .name(s.getName())
                        .sequence(s.getSequence())
                        .terminal(s.isTerminal())
                        .colour(s.getColour())
                        .build())
                .toList();
        Map<UUID, Long> emptyCounts = new LinkedHashMap<>();
        for (CrStatusMatrixResponse.StatusColumn col : statusColumns) {
            emptyCounts.put(col.getId(), 0L);
        }
        return CrStatusMatrixResponse.builder()
                .statuses(statusColumns)
                .rows(List.of())
                .totals(CrStatusMatrixResponse.MatrixTotals.builder()
                        .totalCr(0)
                        .activeCr(0)
                        .statusCounts(emptyCounts)
                        .build())
                .build();
    }

    private static Map<UUID, Long> toCountMap(List<Object[]> rows) {
        Map<UUID, Long> map = new HashMap<>();
        for (Object[] row : rows) {
            map.put((UUID) row[0], ((Number) row[1]).longValue());
        }
        return map;
    }

    private static String employeeFullName(Employee employee) {
        if (employee == null) {
            return null;
        }
        return (employee.getFirstName() + " " + employee.getLastName()).trim();
    }

    private static String normalizeSearch(String q) {
        if (q == null) {
            return null;
        }
        String trimmed = q.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String escapeLike(String value) {
        return value
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }

    /** Supports backlog keys like IX-3580 by matching the UUID hex suffix. */
    private static String extractIssueIdHint(String search) {
        if (search == null) {
            return null;
        }
        String compact = search.replace("-", "").trim();
        if (compact.regionMatches(true, 0, "IX", 0, 2) && compact.length() > 2) {
            compact = compact.substring(2);
        }
        if (compact.isEmpty() || !compact.chars().allMatch(c -> Character.digit(c, 16) >= 0)) {
            return null;
        }
        return compact.length() > 32 ? compact.substring(compact.length() - 32) : compact;
    }

    private static List<UUID> resolveStatusFilter(UUID statusId, List<UUID> statusIds) {
        if (statusIds != null && !statusIds.isEmpty()) {
            return statusIds;
        }
        if (statusId != null) {
            return List.of(statusId);
        }
        return null;
    }

    @Transactional(readOnly = true)
    public IssueResponse getIssue(UUID id) {
        RdIssue issue = loadWithAccess(id);
        IssueResponse response = issueMapper.toResponse(issue);
        enrichWithAllocations(List.of(response));
        response.setCustomFields(customFieldService.loadValuesAsMap(id));
        return response;
    }

    @Transactional
    public IssueResponse createIssue(CreateIssueRequest request) {
        projectService.getProject(request.getProjectId());
        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Project not found", 404));

        Release release = null;
        if (request.getReleaseId() != null) {
            release = releaseRepository.findWithProjectById(request.getReleaseId())
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Release not found", 404));
            if (!release.getProject().getId().equals(project.getId())) {
                throw new BusinessException("VALIDATION", "Release does not belong to this project", 400);
            }
        }

        IssueType issueType = issueTypeRepository.findById(request.getIssueTypeId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue type not found", 404));
        if (!IssueTypeCatalog.isAllowedWorkflowCode(issueType.getWorkflowCode())) {
            throw new BusinessException("VALIDATION", "Issue type is not allowed", 400);
        }
        Priority priority = priorityRepository.findById(request.getPriorityId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Priority not found", 404));
        IssueStatus openStatus = issueStatusRepository.findByName(IssueLifecycleStatuses.DEFAULT_STATUS)
                .orElseThrow(() -> new BusinessException("CONFIG_ERROR", "Default status not configured", 500));

        Employee reporter = employeeRepository.findById(SecurityUtils.currentUserId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Current user not found", 404));

        RdIssue parentIssue = null;
        if (request.getParentIssueId() != null) {
            parentIssue = issueRepository.findDetailedById(request.getParentIssueId())
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Parent item not found", 404));
            if (!parentIssue.getProject().getId().equals(project.getId())) {
                throw new BusinessException("VALIDATION", "Parent item must belong to the same project", 400);
            }
            String parentCode = parentIssue.getIssueType().getWorkflowCode();
            if (!IssueHierarchyRules.canHaveChildren(parentCode)) {
                throw new BusinessException(
                        "VALIDATION",
                        "Items of type " + parentIssue.getIssueType().getName() + " cannot have child items",
                        400);
            }
            if (!IssueHierarchyRules.isValidChild(parentCode, issueType.getWorkflowCode())) {
                throw new BusinessException(
                        "VALIDATION",
                        issueType.getName() + " cannot be created under " + parentIssue.getIssueType().getName(),
                        400);
            }
            if (release == null && parentIssue.getRelease() != null) {
                release = parentIssue.getRelease();
            }
        }

        RdIssue issue = new RdIssue();
        issue.setId(UUID.randomUUID());
        issue.setProject(project);
        issue.setRelease(release);
        issue.setParentIssue(parentIssue);
        issue.setTitle(request.getTitle().trim());
        issue.setDescription(request.getDescription());
        issue.setIssueType(issueType);
        issue.setPriority(priority);
        issue.setStatus(openStatus);
        issue.setReportedBy(reporter);
        if (request.getAssignedToId() != null) {
            issue.setAssignedTo(employeeRepository.findById(request.getAssignedToId())
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Assignee not found", 404)));
        }
        issue.setOriginalEstimation(request.getOriginalEstimation());
        issue.setActualEstimation(request.getActualEstimation());
        issue.setCapitalizable(request.getCapitalizable());
        issue.setComponent(trimToNull(request.getComponent()));
        issue.setSlaDueAt(Instant.now().plus(priority.getSlaResolveHrs(), ChronoUnit.HOURS));
        issue.setSlaStatus("WITHIN");
        issueKeyAllocator.assign(issue, project, parentIssue, issueType.getWorkflowCode());

        issueRepository.save(issue);
        customFieldService.saveValues(
                issue.getId(),
                request.getCustomFields() != null ? request.getCustomFields() : Map.of(),
                true);
        auditLogService.log(SecurityUtils.currentUserId(), "CREATE", "ISSUE", issue.getId(), issue.getTitle(), null);

        return toEnrichedResponse(issueRepository.findDetailedById(issue.getId()).orElseThrow());
    }

    @Transactional(readOnly = true)
    public List<IssueResponse> listChildIssues(UUID parentId) {
        RdIssue parent = loadWithAccess(parentId);
        if (!IssueHierarchyRules.canHaveChildren(parent.getIssueType().getWorkflowCode())) {
            return List.of();
        }
        List<IssueResponse> children = issueRepository.findChildrenByParentId(parentId).stream()
                .map(issueMapper::toResponse)
                .toList();
        enrichWithAllocations(children);
        return children;
    }

    @Transactional(readOnly = true)
    public List<String> allowedChildWorkflowCodes(UUID parentId) {
        RdIssue parent = loadWithAccess(parentId);
        return IssueHierarchyRules.orderedChildWorkflowCodes(parent.getIssueType().getWorkflowCode());
    }

    private IssueResponse toEnrichedResponse(RdIssue issue) {
        IssueResponse response = issueMapper.toResponse(issue);
        enrichWithAllocations(List.of(response));
        response.setCustomFields(customFieldService.loadValuesAsMap(issue.getId()));
        return response;
    }

    private void enrichWithAllocations(List<IssueResponse> issues) {
        if (issues.isEmpty()) {
            return;
        }
        LocalDate asOf = LocalDate.now();
        List<UUID> issueIds = issues.stream().map(IssueResponse::getId).toList();
        List<Allocation> allocations = allocationRepository.findActiveByIssueIds(issueIds, asOf);
        Map<UUID, List<Allocation>> byIssue = allocations.stream()
                .collect(Collectors.groupingBy(a -> a.getIssue().getId()));
        for (IssueResponse issue : issues) {
            applyAllocationSummary(issue, byIssue.getOrDefault(issue.getId(), List.of()));
        }
    }

    private void applyAllocationSummary(IssueResponse issue, List<Allocation> allocations) {
        if (allocations.isEmpty()) {
            return;
        }
        String names = allocations.stream()
                .map(a -> a.getEmployee().getFirstName() + " " + a.getEmployee().getLastName())
                .distinct()
                .collect(Collectors.joining(", "));
        int totalPct = allocations.stream().mapToInt(Allocation::getPercentage).sum();
        issue.setAllocatedToNames(names);
        issue.setUtilizationPct(totalPct);
    }

    @Transactional
    public IssueResponse updateIssue(UUID id, UpdateIssueRequest request) {
        RdIssue issue = loadWithAccess(id);

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            issue.setTitle(request.getTitle().trim());
        }
        if (request.getDescription() != null) {
            issue.setDescription(request.getDescription());
        }
        if (request.getPriorityId() != null) {
            Priority priority = priorityRepository.findById(request.getPriorityId())
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Priority not found", 404));
            issue.setPriority(priority);
            if (!issue.getStatus().isTerminal()) {
                issue.setSlaDueAt(issue.getCreatedAt().plus(priority.getSlaResolveHrs(), ChronoUnit.HOURS));
            }
        }
        if (Boolean.TRUE.equals(request.getClearAssignedTo())) {
            issue.setAssignedTo(null);
        } else if (request.getAssignedToId() != null) {
            issue.setAssignedTo(employeeRepository.findById(request.getAssignedToId())
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Assignee not found", 404)));
        }
        if (Boolean.TRUE.equals(request.getClearRelease())) {
            issue.setRelease(null);
        } else if (request.getReleaseId() != null) {
            Release release = releaseRepository.findWithProjectById(request.getReleaseId())
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Release not found", 404));
            if (!release.getProject().getId().equals(issue.getProject().getId())) {
                throw new BusinessException("VALIDATION", "Release does not belong to this project", 400);
            }
            issue.setRelease(release);
        }
        if (Boolean.TRUE.equals(request.getClearOriginalEstimation())) {
            issue.setOriginalEstimation(null);
        } else if (request.getOriginalEstimation() != null) {
            issue.setOriginalEstimation(request.getOriginalEstimation());
        }
        if (Boolean.TRUE.equals(request.getClearActualEstimation())) {
            issue.setActualEstimation(null);
        } else if (request.getActualEstimation() != null) {
            issue.setActualEstimation(request.getActualEstimation());
        }
        if (request.getCapitalizable() != null) {
            issue.setCapitalizable(request.getCapitalizable());
        }
        if (Boolean.TRUE.equals(request.getClearComponent())) {
            issue.setComponent(null);
        } else if (request.getComponent() != null) {
            issue.setComponent(trimToNull(request.getComponent()));
        }

        issueRepository.save(issue);
        if (request.getCustomFields() != null) {
            customFieldService.saveValues(issue.getId(), request.getCustomFields(), false);
        }
        auditLogService.log(SecurityUtils.currentUserId(), "UPDATE", "ISSUE", issue.getId(), issue.getTitle(), null);
        return toEnrichedResponse(issueRepository.findDetailedById(id).orElseThrow());
    }

    @Transactional
    public IssueResponse transitionIssue(UUID id, TransitionIssueRequest request) {
        RdIssue issue = loadWithAccess(id);
        IssueStatus newStatus = issueStatusRepository.findById(request.getStatusId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Status not found", 404));

        validateWorkflowTransition(issue, newStatus);

        issue.setStatus(newStatus);
        if (newStatus.isTerminal()) {
            if (issue.getSlaDueAt() != null && Instant.now().isAfter(issue.getSlaDueAt())) {
                issue.setSlaStatus("BREACHED");
            } else {
                issue.setSlaStatus("RESOLVED_WITHIN");
            }
        }

        issueRepository.save(issue);
        auditLogService.log(SecurityUtils.currentUserId(), "TRANSITION", "ISSUE", issue.getId(), newStatus.getName(), null);
        return toEnrichedResponse(issueRepository.findDetailedById(id).orElseThrow());
    }

    @Transactional
    public void softDeleteIssue(UUID id) {
        loadWithAccess(id);
        softDeleteService.softDeleteIssue(id);
    }

    @Transactional
    public IssueResponse restoreIssue(UUID id) {
        softDeleteService.restoreIssue(id);
        return getIssue(id);
    }

    private void verifyListAccess(UUID releaseId, UUID projectId) {
        if (projectId != null) {
            projectService.getProject(projectId);
            return;
        }
        if (releaseId != null) {
            Release release = releaseRepository.findWithProjectById(releaseId)
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Release not found", 404));
            projectService.getProject(release.getProject().getId());
            return;
        }
        // Cross-project lists are always scoped via resolveScopedProjectIds (incl. EM portfolio for employees).
    }

    /** Non-null empty list means the user has no accessible projects; null means no extra scope. */
    private List<UUID> resolveScopedProjectIds(UUID projectId, UUID releaseId) {
        if (SecurityUtils.isAdmin() || projectId != null || releaseId != null) {
            return null;
        }
        List<UUID> ids = projectService.getAccessibleProjectIds();
        return ids != null ? ids : List.of();
    }

    private RdIssue loadWithAccess(UUID id) {
        RdIssue issue = issueRepository.findDetailedById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue not found", 404));
        projectService.getProject(issue.getProject().getId());
        return issue;
    }

    private void validateWorkflowTransition(RdIssue issue, IssueStatus newStatus) {
        UUID issueTypeId = issue.getIssueType().getId();
        if (!workflowRuleRepository.existsByIssueType_Id(issueTypeId)) {
            return;
        }
        boolean allowed = workflowRuleRepository.existsByIssueType_IdAndFromStatus_IdAndToStatus_Id(
                issueTypeId, issue.getStatus().getId(), newStatus.getId());
        if (!allowed) {
            throw new BusinessException("INVALID_TRANSITION",
                    "Transition from " + issue.getStatus().getName() + " to " + newStatus.getName() + " is not allowed",
                    400);
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
