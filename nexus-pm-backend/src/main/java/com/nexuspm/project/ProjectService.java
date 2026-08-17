package com.nexuspm.project;

import com.nexuspm.organisation.entity.Client;
import com.nexuspm.organisation.repository.ClientRepository;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.project.dto.*;
import com.nexuspm.project.entity.*;
import com.nexuspm.project.mapper.ProjectMapper;
import com.nexuspm.project.repository.*;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.OrgAccessScopeService;
import com.nexuspm.shared.security.ProjectAccessScope;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.shared.softdelete.SoftDeleteService;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.teamroster.repository.TeamManagementRepository;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private static final Set<String> VALID_RAG = Set.of("GREEN", "AMBER", "RED");

    private final ProjectRepository projectRepository;
    private final BudgetRepository budgetRepository;
    private final ProjectAccessRepository projectAccessRepository;
    private final ProjectHealthLogRepository projectHealthLogRepository;
    private final ClientRepository clientRepository;
    private final EmployeeRepository employeeRepository;
    private final TeamManagementRepository teamManagementRepository;
    private final ProjectMapper projectMapper;
    private final AuditLogService auditLogService;
    private final ProjectProgressService projectProgressService;
    private final RdIssueRepository issueRepository;
    private final SoftDeleteService softDeleteService;
    private final OrgAccessScopeService orgAccessScopeService;

    @Transactional(readOnly = true)
    public Page<ProjectResponse> listProjects(
            UUID clientId,
            UUID regionId,
            UUID countryId,
            String status,
            String ragStatus,
            UUID vpManagementId,
            UUID engineeringManagerManagementId,
            boolean includeArchived,
            Pageable pageable) {
        UUID userId = SecurityUtils.currentUserId();
        ProjectAccessScope scope = orgAccessScopeService.resolveCurrent();
        boolean filterByVpEms = false;
        List<UUID> vpFilterEmIds = List.of(OrgAccessScopeService.EMPTY_EM_SCOPE_ID);
        if (vpManagementId != null) {
            List<UUID> emIds = orgAccessScopeService.findEngineeringManagerIdsUnder(vpManagementId);
            if (emIds.isEmpty()) {
                return Page.empty(pageable);
            }
            filterByVpEms = true;
            vpFilterEmIds = emIds;
        }
        Page<Project> page = projectRepository.findAccessible(
                scope.employeeId(),
                scope.teamManagementId(),
                scope.managerFullName(),
                scope.admin(),
                scope.engineeringPortfolioWide(),
                scope.vpEmScope(),
                scope.emManagementIds(),
                includeArchived,
                clientId,
                regionId,
                countryId,
                status,
                ragStatus,
                filterByVpEms,
                vpFilterEmIds,
                engineeringManagerManagementId,
                pageable);
        Map<UUID, ProjectProgressService.ProgressResult> progressByProject =
                projectProgressService.calculateBatch(page.getContent());
        List<UUID> projectIds = page.getContent().stream().map(Project::getId).toList();
        Map<UUID, Long> backlogCounts = loadBacklogCounts(projectIds);
        Map<UUID, Long> withoutUtilCounts = loadIssuesWithoutUtilizationCounts(projectIds);
        return page.map(project -> {
            ProjectResponse response = toResponse(project, progressByProject.get(project.getId()));
            UUID projectId = project.getId();
            response.setBacklogItemCount(backlogCounts.getOrDefault(projectId, 0L).intValue());
            response.setIssuesWithoutUtilizationCount(withoutUtilCounts.getOrDefault(projectId, 0L).intValue());
            return response;
        });
    }

    @Transactional(readOnly = true)
    public ProjectResponse getProject(UUID id) {
        Project project = loadAccessibleProject(id);
        return toResponse(project);
    }

    /**
     * IDs of projects visible to the current user. {@code null} means org-wide access (admin).
     */
    @Transactional(readOnly = true)
    public List<UUID> getAccessibleProjectIds() {
        if (SecurityUtils.isAdmin()) {
            return null;
        }
        ProjectAccessScope scope = orgAccessScopeService.resolve(SecurityUtils.currentUserId());
        return projectRepository.findAccessibleProjectIds(
                scope.employeeId(),
                scope.teamManagementId(),
                scope.managerFullName(),
                scope.engineeringPortfolioWide(),
                scope.vpEmScope(),
                scope.emManagementIds());
    }

    @Transactional(readOnly = true)
    public ProjectAccessScope accessScopeForCurrentUser() {
        return orgAccessScopeService.resolveCurrent();
    }

    private ProjectAccessScope resolveAccessScope(UUID employeeId) {
        return orgAccessScopeService.resolve(employeeId);
    }

    @Transactional
    public ProjectResponse createProject(CreateProjectRequest request) {
        Client client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Client not found", 404));
        if (projectRepository.existsByClientIdAndNameIgnoreCase(client.getId(), request.getName())) {
            throw new BusinessException("DUPLICATE_PROJECT", "Project name already exists for client", 400);
        }
        Employee lead = employeeRepository.findById(request.getLeadEmployeeId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Lead employee not found", 404));

        Project project = new Project();
        project.setId(UUID.randomUUID());
        project.setClient(client);
        project.setName(request.getName());
        project.setProduct(trimOrNull(request.getProduct()));
        project.setJiraProjectKey(normalizeJiraProjectKey(request.getJiraProjectKey()));
        project.setLeadEmployee(lead);
        applyStakeholdersOnCreate(project, request.getArchitectEmployeeId(),
                request.getEngineeringManagerManagementId());
        project.setStatus("ACTIVE");
        project.setRagStatus("GREEN");
        project.setProgressPct(0);
        validateProjectDates(request.getStartDate(), request.getEndDate());
        project.setStartDate(request.getStartDate());
        project.setEndDate(request.getEndDate());
        projectRepository.save(project);

        if (request.getBudgetAmount() != null) {
            Budget budget = new Budget();
            budget.setId(UUID.randomUUID());
            budget.setProject(project);
            budget.setAmount(request.getBudgetAmount());
            budget.setCurrency(request.getBudgetCurrency() != null ? request.getBudgetCurrency() : "USD");
            budgetRepository.save(budget);
        }

        grantAccess(project, lead, "ADMIN");

        if (request.getTeamAccess() != null) {
            for (ProjectAccessRequest access : request.getTeamAccess()) {
                Employee member = employeeRepository.findById(access.getEmployeeId())
                        .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
                grantAccess(project, member, access.getAccessLevel());
            }
        }

        recordHealthLog(project, "GREEN", "Project created", SecurityUtils.currentUserId());
        auditLogService.log(SecurityUtils.currentUserId(), "CREATE", "PROJECT", project.getId(), project.getName(), null);
        return toResponse(project);
    }

    @Transactional
    public ProjectResponse updateProject(UUID id, UpdateProjectRequest request) {
        Project project = loadAccessibleProjectForEdit(id);
        project.setName(request.getName());
        project.setProduct(trimOrNull(request.getProduct()));
        project.setJiraProjectKey(normalizeJiraProjectKey(request.getJiraProjectKey()));
        if (request.getLeadEmployeeId() != null) {
            Employee lead = employeeRepository.findById(request.getLeadEmployeeId())
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Lead employee not found", 404));
            project.setLeadEmployee(lead);
        }
        setStakeholders(project, request.getArchitectEmployeeId(),
                request.getEngineeringManagerManagementId());
        if (request.getStatus() != null) {
            project.setStatus(request.getStatus());
        }
        LocalDate nextStart = request.getStartDate() != null ? request.getStartDate() : project.getStartDate();
        LocalDate nextEnd = request.getEndDate() != null ? request.getEndDate() : project.getEndDate();
        validateProjectDates(nextStart, nextEnd);
        if (request.getStartDate() != null) {
            project.setStartDate(request.getStartDate());
        }
        if (request.getEndDate() != null) {
            project.setEndDate(request.getEndDate());
        }
        if (request.getBudgetAmount() != null || request.getBudgetCurrency() != null) {
            Budget budget = budgetRepository.findByProjectId(project.getId()).orElseGet(() -> {
                Budget b = new Budget();
                b.setId(UUID.randomUUID());
                b.setProject(project);
                return b;
            });
            if (request.getBudgetAmount() != null) {
                budget.setAmount(request.getBudgetAmount());
            }
            if (request.getBudgetCurrency() != null) {
                budget.setCurrency(request.getBudgetCurrency());
            }
            budgetRepository.save(budget);
        }
        projectRepository.save(project);
        auditLogService.log(SecurityUtils.currentUserId(), "UPDATE", "PROJECT", project.getId(), project.getName(), null);
        return toResponse(project);
    }

    @Transactional
    public ProjectResponse updateRag(UUID id, UpdateRagRequest request) {
        if (!VALID_RAG.contains(request.getRagStatus().toUpperCase())) {
            throw new BusinessException("INVALID_RAG", "RAG must be GREEN, AMBER, or RED", 400);
        }
        Project project = loadAccessibleProjectForEdit(id);
        project.setRagStatus(request.getRagStatus().toUpperCase());
        projectRepository.save(project);
        recordHealthLog(project, project.getRagStatus(), request.getNotes(), SecurityUtils.currentUserId());
        auditLogService.log(SecurityUtils.currentUserId(), "UPDATE", "PROJECT_RAG", project.getId(), project.getRagStatus(), null);
        return toResponse(project);
    }

    @Transactional
    public void softDeleteProject(UUID id) {
        if (!SecurityUtils.isAdmin()) {
            throw new BusinessException("ACCESS_DENIED", "Only admins can delete projects", 403);
        }
        loadAccessibleProjectForEdit(id);
        softDeleteService.softDeleteProject(id);
    }

    @Transactional
    public ProjectResponse restoreProject(UUID id) {
        softDeleteService.restoreProject(id);
        return getProject(id);
    }

    @Transactional
    public ProjectResponse archiveProject(UUID id, boolean archived) {
        if (!SecurityUtils.isAdmin()) {
            throw new BusinessException("ACCESS_DENIED", "Only admins can archive projects", 403);
        }
        Project project = projectRepository.findDetailedById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Project not found", 404));
        if (project.isDeleted()) {
            if (!archived) {
                return restoreProject(id);
            }
            throw new BusinessException("NOT_FOUND", "Project not found", 404);
        }
        project.setArchived(archived);
        if (archived) {
            project.setStatus("ARCHIVED");
        } else {
            project.setStatus("ACTIVE");
        }
        projectRepository.save(project);
        auditLogService.log(SecurityUtils.currentUserId(), archived ? "ARCHIVE" : "RESTORE", "PROJECT", project.getId(), project.getName(), null);
        return toResponse(project);
    }

    @Transactional
    public ProjectAccess grantProjectAccess(UUID projectId, ProjectAccessRequest request) {
        Project project = loadAccessibleProjectForEdit(projectId);
        Employee employee = employeeRepository.findById(request.getEmployeeId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
        return grantAccess(project, employee, request.getAccessLevel());
    }

    @Transactional(readOnly = true)
    public List<ProjectHealthLogResponse> getHealthLog(UUID projectId) {
        loadAccessibleProject(projectId);
        return projectHealthLogRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .map(projectMapper::toResponse)
                .toList();
    }

    private void applyStakeholdersOnCreate(
            Project project,
            UUID architectEmployeeId,
            UUID engineeringManagerManagementId) {
        if (architectEmployeeId != null) {
            project.setArchitectEmployee(loadEmployee(architectEmployeeId, "Architect"));
        }
        if (engineeringManagerManagementId != null) {
            project.setEngineeringManagerManagement(
                    loadManagement(engineeringManagerManagementId, "Engineering manager"));
        }
    }

    private void setStakeholders(
            Project project,
            UUID architectEmployeeId,
            UUID engineeringManagerManagementId) {
        project.setArchitectEmployee(architectEmployeeId != null
                ? loadEmployee(architectEmployeeId, "Architect") : null);
        project.setEngineeringManagerManagement(engineeringManagerManagementId != null
                ? loadManagement(engineeringManagerManagementId, "Engineering manager") : null);
    }

    private Employee loadEmployee(UUID id, String label) {
        return employeeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", label + " not found", 404));
    }

    private TeamManagement loadManagement(UUID id, String label) {
        return teamManagementRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", label + " not found", 404));
    }

    private ProjectResponse toResponse(Project project) {
        return toResponse(project, projectProgressService.calculate(
                project.getId(), project.getStartDate(), project.getEndDate()));
    }

    private ProjectResponse toResponse(Project project, ProjectProgressService.ProgressResult progress) {
        Budget budget = budgetRepository.findByProjectId(project.getId()).orElse(null);
        int teamSize = projectAccessRepository.findByProjectId(project.getId()).size();
        ProjectResponse response = projectMapper.toResponse(project, budget, teamSize);
        if (progress != null) {
            response.setProgressPct(progress.percent());
            response.setProgressBasis(progress.basis());
        }
        response.setBacklogItemCount(countBacklogItems(project.getId()));
        response.setIssuesWithoutUtilizationCount(countIssuesWithoutUtilization(project.getId()));
        return response;
    }

    private Map<UUID, Long> loadBacklogCounts(List<UUID> projectIds) {
        if (projectIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Long> counts = new HashMap<>();
        for (Object[] row : issueRepository.countBacklogByProjectIds(projectIds)) {
            counts.put((UUID) row[0], ((Number) row[1]).longValue());
        }
        return counts;
    }

    private Map<UUID, Long> loadIssuesWithoutUtilizationCounts(List<UUID> projectIds) {
        if (projectIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Long> counts = new HashMap<>();
        for (Object[] row : issueRepository.countIssuesWithoutUtilizationByProjectIds(projectIds, LocalDate.now())) {
            counts.put((UUID) row[0], ((Number) row[1]).longValue());
        }
        return counts;
    }

    private int countBacklogItems(UUID projectId) {
        return issueRepository.countBacklogByProjectIds(List.of(projectId)).stream()
                .findFirst()
                .map(row -> ((Number) row[1]).intValue())
                .orElse(0);
    }

    private int countIssuesWithoutUtilization(UUID projectId) {
        return issueRepository.countIssuesWithoutUtilizationByProjectIds(List.of(projectId), LocalDate.now()).stream()
                .findFirst()
                .map(row -> ((Number) row[1]).intValue())
                .orElse(0);
    }

    private Project loadAccessibleProject(UUID id) {
        Project project = projectRepository.findDetailedById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Project not found", 404));
        if (project.isDeleted() && !SecurityUtils.isSuperAdmin()) {
            throw new BusinessException("NOT_FOUND", "Project not found", 404);
        }
        if (!canAccess(project)) {
            throw new BusinessException("ACCESS_DENIED", "You do not have access to this project", 403);
        }
        return project;
    }

    private Project loadAccessibleProjectForEdit(UUID id) {
        Project project = loadAccessibleProject(id);
        if (!SecurityUtils.isManagerOrAbove() && !hasEditAccess(project)) {
            throw new BusinessException("ACCESS_DENIED", "You cannot edit this project", 403);
        }
        return project;
    }

    private boolean canAccess(Project project) {
        if (SecurityUtils.isAdmin()) {
            return true;
        }
        UUID userId = SecurityUtils.currentUserId();
        ProjectAccessScope access = resolveAccessScope(userId);
        if (project.getLeadEmployee() != null && userId.equals(project.getLeadEmployee().getId())) {
            return true;
        }
        if (project.getArchitectEmployee() != null && userId.equals(project.getArchitectEmployee().getId())) {
            return true;
        }
        if (access.engineeringPortfolioWide() && project.getEngineeringManagerManagement() != null) {
            return true;
        }
        if (access.hasVpEmScope() && project.getEngineeringManagerManagement() != null
                && access.emManagementIds().contains(project.getEngineeringManagerManagement().getId())) {
            return true;
        }
        if (access.teamManagementId() != null) {
            if (project.getEngineeringManagerManagement() != null
                    && access.teamManagementId().equals(project.getEngineeringManagerManagement().getId())) {
                return true;
            }
        }
        if (access.managerFullName() != null) {
            if (project.getEngineeringManagerManagement() != null
                    && access.managerFullName().equalsIgnoreCase(project.getEngineeringManagerManagement().getFullName())) {
                return true;
            }
        }
        return projectAccessRepository.existsByProjectIdAndEmployeeId(project.getId(), userId);
    }

    private boolean hasEditAccess(Project project) {
        return projectAccessRepository.findByProjectIdAndEmployeeId(project.getId(), SecurityUtils.currentUserId())
                .map(pa -> "EDIT".equals(pa.getAccessLevel()) || "ADMIN".equals(pa.getAccessLevel()))
                .orElse(false);
    }

    private ProjectAccess grantAccess(Project project, Employee employee, String accessLevel) {
        ProjectAccess access = projectAccessRepository
                .findByProjectIdAndEmployeeId(project.getId(), employee.getId())
                .orElseGet(() -> {
                    ProjectAccess pa = new ProjectAccess();
                    pa.setId(UUID.randomUUID());
                    pa.setProject(project);
                    pa.setEmployee(employee);
                    return pa;
                });
        access.setAccessLevel(accessLevel.toUpperCase());
        return projectAccessRepository.save(access);
    }

    private void recordHealthLog(Project project, String ragStatus, String notes, UUID changedById) {
        Employee changedBy = employeeRepository.findById(changedById).orElse(null);
        ProjectHealthLog log = new ProjectHealthLog();
        log.setId(UUID.randomUUID());
        log.setProject(project);
        log.setRagStatus(ragStatus);
        log.setNotes(notes);
        log.setChangedBy(changedBy);
        projectHealthLogRepository.save(log);
    }

    private static void validateProjectDates(LocalDate startDate, LocalDate endDate) {
        if (startDate != null && endDate != null && endDate.isBefore(startDate)) {
            throw new BusinessException("INVALID_DATES", "End date must be on or after the start date", 400);
        }
    }

    private static String trimOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String normalizeJiraProjectKey(String value) {
        String trimmed = trimOrNull(value);
        return trimmed == null ? null : trimmed.toUpperCase();
    }
}
