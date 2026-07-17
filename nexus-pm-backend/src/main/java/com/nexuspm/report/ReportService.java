package com.nexuspm.report;

import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.notification.dto.NotificationResponse;
import com.nexuspm.notification.repository.NotificationRepository;
import com.nexuspm.project.ProjectService;
import com.nexuspm.project.entity.Project;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.report.dto.*;
import com.nexuspm.resource.repository.AllocationRepository;
import com.nexuspm.shared.security.OrgAccessScopeService;
import com.nexuspm.shared.security.ProjectAccessScope;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.user.ManagerTeamService;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ProjectRepository projectRepository;
    private final ProjectService projectService;
    private final RdIssueRepository issueRepository;
    private final AllocationRepository allocationRepository;
    private final NotificationRepository notificationRepository;
    private final EmployeeRepository employeeRepository;
    private final ManagerTeamService managerTeamService;
    private final OrgWorkforceService orgWorkforceService;

    @Transactional(readOnly = true)
    public DashboardSummaryResponse getDashboardSummary() {
        UUID userId = SecurityUtils.currentUserId();
        ProjectAccessScope scope = projectService.accessScopeForCurrentUser();
        boolean teamView = SecurityUtils.isManagerOrAbove();
        List<UUID> scopedProjectIds = scope.admin() ? null : projectService.getAccessibleProjectIds();

        long activeProjects = projectRepository.countActiveAccessible(
                scope.employeeId(),
                scope.teamManagementId(),
                scope.managerFullName(),
                scope.admin(),
                scope.engineeringPortfolioWide(),
                scope.vpEmScope(),
                scope.emManagementIds());
        long openIssues = issueRepository.countOpenAccessible(
                scope.employeeId(),
                scope.teamManagementId(),
                scope.managerFullName(),
                scope.admin(),
                scope.engineeringPortfolioWide(),
                scope.vpEmScope(),
                scope.emManagementIds());

        int utilisation = computeUtilisation(userId, teamView, scopedProjectIds);
        long unread = notificationRepository.countByEmployee_IdAndReadFlagFalse(userId);
        long overAllocated = teamView
                ? countOverAllocatedEmployees(scopedProjectIds)
                : 0;

        return DashboardSummaryResponse.builder()
                .activeProjects(activeProjects)
                .openIssues(openIssues)
                .teamUtilisationPct(utilisation)
                .unreadNotifications(unread)
                .overAllocatedEmployees(overAllocated)
                .build();
    }

    @Transactional(readOnly = true)
    public DashboardOverviewResponse getDashboardOverview() {
        UUID userId = SecurityUtils.currentUserId();
        ProjectAccessScope scope = projectService.accessScopeForCurrentUser();
        boolean teamView = SecurityUtils.isManagerOrAbove();
        List<UUID> scopedProjectIds = scope.admin() ? null : projectService.getAccessibleProjectIds();

        DashboardSummaryResponse summary = getDashboardSummary();

        List<Project> activeProjects = projectRepository.findAccessible(
                scope.employeeId(),
                scope.teamManagementId(),
                scope.managerFullName(),
                scope.admin(),
                scope.engineeringPortfolioWide(),
                scope.vpEmScope(),
                scope.emManagementIds(),
                false,
                null,
                null,
                null,
                "ACTIVE",
                null,
                false,
                List.of(OrgAccessScopeService.EMPTY_EM_SCOPE_ID),
                null,
                PageRequest.of(0, 8, Sort.by("name"))).getContent();

        Map<UUID, Long> openIssuesByProject = loadOpenIssueCounts(activeProjects);

        List<ProjectDashboardItem> projectItems = activeProjects.stream()
                .map(p -> ProjectDashboardItem.builder()
                        .id(p.getId())
                        .name(p.getName())
                        .clientName(p.getClient() != null ? p.getClient().getName() : null)
                        .ragStatus(p.getRagStatus())
                        .progressPct(p.getProgressPct())
                        .status(p.getStatus())
                        .openIssues(openIssuesByProject.getOrDefault(p.getId(), 0L))
                        .build())
                .toList();

        List<NotificationResponse> recentNotifications = notificationRepository
                .findByEmployee_IdOrderByCreatedAtDesc(userId)
                .stream()
                .limit(6)
                .map(n -> NotificationResponse.builder()
                        .id(n.getId())
                        .title(n.getTitle())
                        .body(n.getBody())
                        .type(n.getType())
                        .read(n.isReadFlag())
                        .createdAt(n.getCreatedAt())
                        .build())
                .toList();

        List<UtilisationSnapshot> utilisation = buildUtilisationSnapshots(userId, teamView, scopedProjectIds);

        OrgWorkforceSummary orgWorkforce = null;
        List<VpOrgBreakdownRow> vpBreakdown = List.of();
        List<EmOrgBreakdownRow> emBreakdown = List.of();
        if (scope.admin() || scope.engineeringPortfolioWide()) {
            orgWorkforce = orgWorkforceService.buildSummary();
            vpBreakdown = orgWorkforceService.buildVpBreakdown();
            emBreakdown = orgWorkforceService.buildEmBreakdown();
        }

        return DashboardOverviewResponse.builder()
                .summary(summary)
                .projects(projectItems)
                .recentNotifications(recentNotifications)
                .utilisation(utilisation)
                .orgWorkforce(orgWorkforce)
                .vpBreakdown(vpBreakdown)
                .emBreakdown(emBreakdown)
                .generatedAt(Instant.now())
                .build();
    }

    private Map<UUID, Long> loadOpenIssueCounts(List<Project> projects) {
        if (projects.isEmpty()) {
            return Map.of();
        }
        List<UUID> ids = projects.stream().map(Project::getId).toList();
        Map<UUID, Long> openByProject = new HashMap<>();
        for (Object[] row : issueRepository.countIssueProgressByProjectIds(ids)) {
            UUID projectId = (UUID) row[0];
            long total = ((Number) row[1]).longValue();
            long terminal = row[2] != null ? ((Number) row[2]).longValue() : 0L;
            openByProject.put(projectId, Math.max(0, total - terminal));
        }
        return openByProject;
    }

    private List<UtilisationSnapshot> buildUtilisationSnapshots(
            UUID userId, boolean teamView, List<UUID> scopedProjectIds) {
        LocalDate today = LocalDate.now();
        if (teamView) {
            if (scopedProjectIds != null) {
                if (scopedProjectIds.isEmpty()) {
                    return List.of();
                }
                Map<UUID, Integer> pctByEmployee = utilisationByEmployeeForProjects(today, scopedProjectIds);
                return managerTeamService.resolveTeam(userId).stream()
                        .map(employee -> {
                            int total = pctByEmployee.getOrDefault(employee.getId(), 0);
                            return UtilisationSnapshot.builder()
                                    .employeeId(employee.getId())
                                    .employeeName(employee.getFullName())
                                    .totalPct(total)
                                    .overAllocated(total > 100)
                                    .build();
                        })
                        .sorted(Comparator.comparingInt(UtilisationSnapshot::getTotalPct).reversed())
                        .limit(8)
                        .toList();
            }
            return allocationRepository.sumPercentageByEmployee(today).stream()
                    .map(row -> {
                        int total = ((Number) row[3]).intValue();
                        return UtilisationSnapshot.builder()
                                .employeeId((UUID) row[0])
                                .employeeName(row[1] + " " + row[2])
                                .totalPct(total)
                                .overAllocated(total > 100)
                                .build();
                    })
                    .sorted(Comparator.comparingInt(UtilisationSnapshot::getTotalPct).reversed())
                    .limit(8)
                    .toList();
        }
        int mine = allocationRepository.findActive(null, null, userId, today).stream()
                .mapToInt(a -> a.getPercentage())
                .sum();
        if (mine == 0) {
            return List.of();
        }
        Employee self = allocationRepository.findActive(null, null, userId, today).stream()
                .findFirst()
                .map(a -> a.getEmployee())
                .orElse(null);
        if (self == null) {
            return List.of();
        }
        return List.of(UtilisationSnapshot.builder()
                .employeeId(self.getId())
                .employeeName(self.getFullName())
                .totalPct(mine)
                .overAllocated(mine > 100)
                .build());
    }

    private int computeUtilisation(UUID userId, boolean teamView, List<UUID> scopedProjectIds) {
        LocalDate today = LocalDate.now();
        if (teamView) {
            if (scopedProjectIds != null) {
                if (scopedProjectIds.isEmpty()) {
                    return 0;
                }
                Map<UUID, Integer> pctByEmployee = utilisationByEmployeeForProjects(today, scopedProjectIds);
                return (int) managerTeamService.resolveTeam(userId).stream()
                        .mapToInt(employee -> pctByEmployee.getOrDefault(employee.getId(), 0))
                        .average()
                        .orElse(0);
            }
            return (int) allocationRepository.sumPercentageByEmployee(today).stream()
                    .mapToInt(row -> ((Number) row[3]).intValue())
                    .average()
                    .orElse(0);
        }
        return allocationRepository.findActive(null, null, userId, today).stream()
                .mapToInt(a -> a.getPercentage())
                .sum();
    }

    private long countOverAllocatedEmployees(List<UUID> scopedProjectIds) {
        LocalDate today = LocalDate.now();
        if (scopedProjectIds != null) {
            if (scopedProjectIds.isEmpty()) {
                return 0;
            }
            UUID managerId = SecurityUtils.currentUserId();
            Map<UUID, Integer> pctByEmployee = utilisationByEmployeeForProjects(today, scopedProjectIds);
            return managerTeamService.resolveTeam(managerId).stream()
                    .filter(employee -> pctByEmployee.getOrDefault(employee.getId(), 0) > 100)
                    .count();
        }
        List<Object[]> rows = allocationRepository.sumPercentageByEmployee(today);
        return rows.stream()
                .filter(row -> ((Number) row[3]).intValue() > 100)
                .count();
    }

    private UUID resolveTeamManagementId(UUID employeeId) {
        return employeeRepository.findDetailedById(employeeId)
                .map(Employee::getTeamManagement)
                .map(TeamManagement::getId)
                .orElse(null);
    }

    private String resolveManagerFullName(UUID employeeId) {
        return employeeRepository.findDetailedById(employeeId)
                .map(Employee::getFullName)
                .orElse(null);
    }

    private Map<UUID, Integer> utilisationByEmployeeForProjects(LocalDate asOf, List<UUID> projectIds) {
        Map<UUID, Integer> pctByEmployee = new HashMap<>();
        for (Object[] row : allocationRepository.sumPercentageByEmployeeForProjects(asOf, projectIds)) {
            pctByEmployee.put((UUID) row[0], ((Number) row[3]).intValue());
        }
        return pctByEmployee;
    }
}
