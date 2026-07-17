package com.nexuspm.resource;

import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.project.ProjectService;
import com.nexuspm.resource.dto.*;
import com.nexuspm.resource.entity.Allocation;
import com.nexuspm.resource.exception.OverAllocationException;
import com.nexuspm.resource.mapper.ResourceMapper;
import com.nexuspm.resource.repository.AllocationRepository;
import com.nexuspm.notification.NotificationService;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.shared.storage.ProfilePictureStorageService;
import com.nexuspm.auth.repository.UserAuthRepository;
import com.nexuspm.user.ManagerTeamService;
import com.nexuspm.user.EmployeeRosterRefs;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class AllocationService {

    /** MySQL DATE max; {@link LocalDate#MAX} overflows and binds as an invalid date. */
    private static final LocalDate OPEN_ENDED_RANGE_END = LocalDate.of(9999, 12, 31);


    private final AllocationRepository allocationRepository;
    private final EmployeeRepository employeeRepository;
    private final UserAuthRepository userAuthRepository;
    private final RdIssueRepository issueRepository;
    private final ProjectService projectService;
    private final ResourceMapper resourceMapper;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final ManagerTeamService managerTeamService;

    @Transactional(readOnly = true)
    public List<AllocationResponse> listAllocations(
            UUID projectId, UUID issueId, UUID employeeId, LocalDate asOf, LocalDate from, LocalDate to) {
        verifyListAccess(projectId, issueId, employeeId);
        List<UUID> scopedProjectIds = resolveScopedProjectIds(projectId, issueId);
        if (scopedProjectIds != null && scopedProjectIds.isEmpty()) {
            return List.of();
        }

        if (issueId != null) {
            return mapAndScope(allocationRepository.findByIssue(issueId), scopedProjectIds);
        }

        if (employeeId != null && from != null) {
            LocalDate rangeEnd = to != null ? to : OPEN_ENDED_RANGE_END;
            return mapAndScope(
                    allocationRepository.findOverlapping(employeeId, from, rangeEnd).stream()
                            .filter(a -> projectId == null || a.getIssue().getProject().getId().equals(projectId))
                            .toList(),
                    scopedProjectIds);
        }

        if (employeeId != null && projectId == null) {
            return mapAndScope(allocationRepository.findByEmployee(employeeId), scopedProjectIds);
        }

        if (projectId != null && employeeId == null && asOf == null) {
            return mapAndScope(allocationRepository.findByProject(projectId), scopedProjectIds);
        }

        LocalDate effectiveDate = asOf != null ? asOf : LocalDate.now();
        if (scopedProjectIds != null) {
            return mapAndScope(
                    allocationRepository.findActiveForProjects(
                            scopedProjectIds, issueId, employeeId, effectiveDate),
                    null);
        }
        return mapAndScope(
                allocationRepository.findActive(projectId, issueId, employeeId, effectiveDate),
                null);
    }

    @Transactional(readOnly = true)
    public List<CapacityResponse> getCapacity(
            LocalDate from, LocalDate to, LocalDate asOf, String team, String designationCode,
            String engineeringManager, String name) {
        if (!SecurityUtils.isManagerOrAbove()) {
            throw new BusinessException("ACCESS_DENIED", "Only managers can view team capacity", 403);
        }
        LocalDate rangeStart = from != null ? from : LocalDate.now().withDayOfMonth(1);
        LocalDate rangeEnd = to != null ? to : rangeStart.plusMonths(5).withDayOfMonth(rangeStart.plusMonths(5).lengthOfMonth());
        LocalDate snapshotAsOf = asOf != null ? asOf : LocalDate.now();

        String nameFilter = name != null && !name.isBlank() ? name.trim() : null;
        String teamFilter = team != null && !team.isBlank() ? team.trim() : null;
        String designationFilter = designationCode != null && !designationCode.isBlank()
                ? designationCode.trim()
                : null;
        String engineeringManagerFilter = engineeringManager != null && !engineeringManager.isBlank()
                ? engineeringManager.trim()
                : null;

        List<UUID> scopedProjectIds = SecurityUtils.isAdmin() ? null : projectService.getAccessibleProjectIds();
        if (scopedProjectIds != null && scopedProjectIds.isEmpty()) {
            return List.of();
        }

        List<Employee> rosterEmployees = employeeRepository.findActiveRosterFiltered(
                nameFilter, teamFilter, designationFilter, engineeringManagerFilter);

        List<Allocation> inRange = scopedProjectIds == null
                ? allocationRepository.findInRange(rangeStart, rangeEnd, null)
                : allocationRepository.findInRangeForProjects(rangeStart, rangeEnd, scopedProjectIds);
        List<Allocation> activeAtAsOf = scopedProjectIds == null
                ? allocationRepository.findActive(null, null, null, snapshotAsOf)
                : allocationRepository.findActiveForProjects(scopedProjectIds, null, null, snapshotAsOf);

        if (scopedProjectIds != null) {
            UUID managerId = SecurityUtils.currentUserId();
            Map<UUID, Employee> teamById = new LinkedHashMap<>();
            managerTeamService.resolveTeam(managerId).forEach(member -> teamById.put(member.getId(), member));

            Set<UUID> allocatedEmployeeIds = new HashSet<>();
            inRange.forEach(a -> allocatedEmployeeIds.add(a.getEmployee().getId()));
            activeAtAsOf.forEach(a -> allocatedEmployeeIds.add(a.getEmployee().getId()));
            rosterEmployees.stream()
                    .filter(employee -> allocatedEmployeeIds.contains(employee.getId()))
                    .forEach(employee -> teamById.putIfAbsent(employee.getId(), employee));

            rosterEmployees = teamById.values().stream()
                    .filter(employee -> matchesRosterFilters(
                            employee, nameFilter, teamFilter, designationFilter, engineeringManagerFilter))
                    .sorted(Comparator.comparing(Employee::getLastName).thenComparing(Employee::getFirstName))
                    .toList();
        }

        Map<UUID, List<Allocation>> periodByEmployee = inRange.stream()
                .collect(Collectors.groupingBy(a -> a.getEmployee().getId()));
        Map<UUID, List<Allocation>> asOfByEmployee = activeAtAsOf.stream()
                .collect(Collectors.groupingBy(a -> a.getEmployee().getId()));

        Map<UUID, String> vpNameByEmId = new HashMap<>();

        return rosterEmployees.stream()
                .map(employee -> {
                    UUID employeeId = employee.getId();
                    List<Allocation> periodEntities = periodByEmployee.getOrDefault(employeeId, List.of());
                    List<Allocation> asOfEntities = asOfByEmployee.getOrDefault(employeeId, List.of());
                    List<AllocationResponse> snapshot = asOfEntities.stream()
                            .map(resourceMapper::toResponse)
                            .toList();
                    List<AllocationResponse> period = periodEntities.stream()
                            .map(resourceMapper::toResponse)
                            .toList();
                    int periodAllocated = averageAllocatedPct(periodEntities, rangeStart, rangeEnd);
                    var em = employee.getEngineeringManagerManagement();
                    String vpName = null;
                    if (em != null) {
                        vpName = vpNameByEmId.computeIfAbsent(
                                em.getId(), ignored -> EmployeeRosterRefs.vpNameForManager(em));
                    }
                    return CapacityResponse.builder()
                            .employeeId(employeeId)
                            .employeeName(employee.getFullName())
                            .profilePictureUrl(ProfilePictureStorageService.memberPhotoUrl(
                                    employee.getId(),
                                    employee.getProfilePicture(),
                                    employee.getUpdatedAt()))
                            .departmentName(EmployeeRosterRefs.teamName(employee))
                            .designationName(EmployeeRosterRefs.designationName(employee))
                            .vpName(vpName)
                            .engineeringManagerName(EmployeeRosterRefs.engineeringManagerName(employee))
                            .benchStatus(employee.getBenchStatus())
                            .totalPercentage(periodAllocated)
                            .availablePercentage(Math.max(0, 100 - periodAllocated))
                            .overAllocated(periodAllocated > 100)
                            .allocations(snapshot)
                            .periodAllocations(period)
                            .build();
                })
                .sorted(capacityOrgComparator())
                .toList();
    }

    /**
     * Average daily allocation load over an inclusive date range.
     * Each day sums overlapping allocation percentages; days with no work count as 0%.
     */
    static int averageAllocatedPct(List<Allocation> allocations, LocalDate rangeStart, LocalDate rangeEnd) {
        if (rangeStart == null || rangeEnd == null || rangeStart.isAfter(rangeEnd)) {
            return 0;
        }
        long dayCount = ChronoUnit.DAYS.between(rangeStart, rangeEnd) + 1;
        if (dayCount <= 0) {
            return 0;
        }
        if (allocations == null || allocations.isEmpty()) {
            return 0;
        }
        long sum = 0;
        for (LocalDate day = rangeStart; !day.isAfter(rangeEnd); day = day.plusDays(1)) {
            int dayPct = 0;
            for (Allocation allocation : allocations) {
                if (coversDay(allocation, day)) {
                    Integer pct = allocation.getPercentage();
                    if (pct != null) {
                        dayPct += pct;
                    }
                }
            }
            sum += dayPct;
        }
        return (int) Math.round(sum / (double) dayCount);
    }

    private static boolean coversDay(Allocation allocation, LocalDate day) {
        LocalDate from = allocation.getFromDate();
        if (from != null && from.isAfter(day)) {
            return false;
        }
        LocalDate to = allocation.getToDate();
        return to == null || !to.isBefore(day);
    }

    private static Comparator<CapacityResponse> capacityOrgComparator() {
        return Comparator
                .comparing((CapacityResponse r) -> sortKey(r.getVpName()))
                .thenComparing(r -> sortKey(r.getEngineeringManagerName()))
                .thenComparing(r -> sortKey(r.getEmployeeName()));
    }

    private static String sortKey(String value) {
        if (value == null || value.isBlank()) {
            return "\uFFFF";
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional(readOnly = true)
    public List<RosterAllocationResourceResponse> listRosterAllocationResources() {
        if (!SecurityUtils.isManagerOrAbove()) {
            throw new BusinessException("ACCESS_DENIED", "Only managers can view roster resources", 403);
        }
        return employeeRepository.searchRosterMembers(null).stream()
                .map(employee -> RosterAllocationResourceResponse.builder()
                        .employeeId(employee.getId())
                        .fullName(employee.getFullName())
                        .designationName(EmployeeRosterRefs.designationName(employee))
                        .teamName(EmployeeRosterRefs.teamName(employee))
                        .engineeringManagerName(EmployeeRosterRefs.engineeringManagerName(employee))
                        .build())
                .toList();
    }

    private boolean matchesRosterFilters(
            Employee employee,
            String nameFilter,
            String teamFilter,
            String designationFilter,
            String engineeringManagerFilter) {
        if (nameFilter != null) {
            String haystack = (employee.getFullName()
                    + " " + nullToEmpty(EmployeeRosterRefs.designationName(employee))
                    + " " + nullToEmpty(EmployeeRosterRefs.designationCode(employee))
                    + " " + nullToEmpty(EmployeeRosterRefs.teamName(employee))
                    + " " + nullToEmpty(employee.getEmail())).toLowerCase();
            if (!haystack.contains(nameFilter.toLowerCase())) {
                return false;
            }
        }
        if (teamFilter != null
                && !teamFilter.equalsIgnoreCase(nullToEmpty(EmployeeRosterRefs.teamName(employee)))) {
            return false;
        }
        if (designationFilter != null
                && !designationFilter.equalsIgnoreCase(nullToEmpty(EmployeeRosterRefs.designationCode(employee)))) {
            return false;
        }
        if (engineeringManagerFilter != null) {
            String em = nullToEmpty(EmployeeRosterRefs.engineeringManagerName(employee)).toLowerCase();
            if (!em.contains(engineeringManagerFilter.toLowerCase())) {
                return false;
            }
        }
        return true;
    }

    private String nullToEmpty(String value) {
        return value != null ? value : "";
    }

    @Transactional
    public AllocationResponse createAllocation(CreateAllocationRequest request) {
        if (!SecurityUtils.isManagerOrAbove()) {
            throw new BusinessException("ACCESS_DENIED", "Only managers can create allocations", 403);
        }

        RdIssue issue = issueRepository.findById(request.getIssueId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue not found", 404));
        projectService.getProject(issue.getProject().getId());

        Employee employee = employeeRepository.findById(request.getEmployeeId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
        if (userAuthRepository.existsByEmployeeId(employee.getId())) {
            throw new BusinessException("VALIDATION", "Allocations must target roster employees, not login users", 400);
        }

        if (request.getToDate().isBefore(request.getFromDate())) {
            throw new BusinessException("VALIDATION", "End date must be on or after start date", 400);
        }

        validateEmployeeCapacity(
                employee.getId(),
                request.getFromDate(),
                request.getToDate(),
                request.getPercentage(),
                null);

        Allocation allocation = new Allocation();
        allocation.setId(UUID.randomUUID());
        allocation.setEmployee(employee);
        allocation.setIssue(issue);
        allocation.setRoleOnProject(request.getRoleOnProject());
        allocation.setPercentage(request.getPercentage());
        allocation.setFromDate(request.getFromDate());
        allocation.setToDate(request.getToDate());
        allocation.setBillable(request.getBillable() == null || request.getBillable());

        allocationRepository.save(allocation);
        var projectName = issue.getProject().getName();
        auditLogService.log(SecurityUtils.currentUserId(), "CREATE", "ALLOCATION", allocation.getId(),
                employee.getFirstName() + " → " + issue.getTitle(), null);
        notificationService.notifyEmployee(
                employee.getId(),
                "New allocation: " + issue.getTitle(),
                "You have been allocated " + request.getPercentage() + "% on " + projectName
                        + " from " + request.getFromDate() + ".",
                "ALLOCATION");
        return resourceMapper.toResponse(allocation);
    }

    @Transactional
    public AllocationResponse updateAllocation(UUID id, UpdateAllocationRequest request) {
        if (!SecurityUtils.isManagerOrAbove()) {
            throw new BusinessException("ACCESS_DENIED", "Only managers can update allocations", 403);
        }

        Allocation allocation = allocationRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Allocation not found", 404));
        projectService.getProject(allocation.getIssue().getProject().getId());

        if (request.getToDate().isBefore(request.getFromDate())) {
            throw new BusinessException("VALIDATION", "End date must be on or after start date", 400);
        }

        validateEmployeeCapacity(
                allocation.getEmployee().getId(),
                request.getFromDate(),
                request.getToDate(),
                request.getPercentage(),
                id);

        allocation.setRoleOnProject(request.getRoleOnProject());
        allocation.setPercentage(request.getPercentage());
        allocation.setFromDate(request.getFromDate());
        allocation.setToDate(request.getToDate());
        if (request.getBillable() != null) {
            allocation.setBillable(request.getBillable());
        }

        allocationRepository.save(allocation);
        var issue = allocation.getIssue();
        auditLogService.log(SecurityUtils.currentUserId(), "UPDATE", "ALLOCATION", id,
                allocation.getEmployee().getFirstName() + " → " + issue.getTitle(), null);
        return resourceMapper.toResponse(allocation);
    }

    @Transactional
    public void deleteAllocation(UUID id) {
        if (!SecurityUtils.isManagerOrAbove()) {
            throw new BusinessException("ACCESS_DENIED", "Only managers can delete allocations", 403);
        }
        Allocation allocation = allocationRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Allocation not found", 404));
        allocationRepository.delete(allocation);
        auditLogService.log(SecurityUtils.currentUserId(), "DELETE", "ALLOCATION", id, null, null);
    }

    private List<String> roleCodesForFilter(String roleFilter) {
        if (roleFilter == null || roleFilter.isBlank()) {
            return null;
        }
        return switch (roleFilter.trim().toUpperCase()) {
            case "CEO" -> List.of("CEO");
            case "CXO", "CTO" -> List.of("CXO", "CTO");
            case "VP", "VP_ENG" -> List.of("VP", "VP_ENG");
            case "SR_SEM" -> List.of("SR_SEM");
            case "MANAGER", "SEM" -> List.of("MANAGER", "SEM");
            case "TECH_LEAD" -> List.of("TECH_LEAD");
            case "EMPLOYEE", "SW_ENGINEER" -> List.of("SW_ENGINEER");
            default -> null;
        };
    }

    private void verifyListAccess(UUID projectId, UUID issueId, UUID employeeId) {
        if (issueId != null) {
            RdIssue issue = issueRepository.findById(issueId)
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue not found", 404));
            projectService.getProject(issue.getProject().getId());
            return;
        }
        if (projectId != null) {
            projectService.getProject(projectId);
            return;
        }
        if (employeeId != null) {
            if (!SecurityUtils.isAdmin() && !SecurityUtils.isManager()
                    && !employeeId.equals(SecurityUtils.currentUserId())) {
                throw new BusinessException("ACCESS_DENIED", "You can only view your own allocations", 403);
            }
            return;
        }
        if (SecurityUtils.isAdmin() || SecurityUtils.isManager()) {
            return;
        }
        throw new BusinessException("ACCESS_DENIED", "Specify projectId, issueId, or employeeId to view allocations", 403);
    }

    private List<UUID> resolveScopedProjectIds(UUID projectId, UUID issueId) {
        if (SecurityUtils.isAdmin() || projectId != null || issueId != null) {
            return null;
        }
        return projectService.getAccessibleProjectIds();
    }

    private List<AllocationResponse> mapAndScope(List<Allocation> allocations, List<UUID> scopedProjectIds) {
        Stream<Allocation> stream = allocations.stream();
        if (scopedProjectIds != null) {
            Set<UUID> allowed = new HashSet<>(scopedProjectIds);
            stream = stream.filter(a -> allowed.contains(a.getIssue().getProject().getId()));
        }
        return stream.map(resourceMapper::toResponse).toList();
    }

    private void validateEmployeeCapacity(
            UUID employeeId,
            LocalDate fromDate,
            LocalDate toDate,
            int newPercentage,
            UUID excludeAllocationId) {
        LocalDate rangeEnd = toDate != null ? toDate : OPEN_ENDED_RANGE_END;
        List<Allocation> overlapping = allocationRepository.findOverlapping(employeeId, fromDate, rangeEnd).stream()
                .filter(a -> excludeAllocationId == null || !a.getId().equals(excludeAllocationId))
                .toList();
        int existingTotal = overlapping.stream().mapToInt(Allocation::getPercentage).sum();
        int totalWouldBe = existingTotal + newPercentage;
        if (totalWouldBe > 100) {
            List<AllocationOverlapItem> breakdown = overlapping.stream()
                    .map(a -> {
                        var project = a.getIssue().getProject();
                        return AllocationOverlapItem.builder()
                                .allocationId(a.getId())
                                .issueId(a.getIssue().getId())
                                .issueTitle(a.getIssue().getTitle())
                                .projectId(project.getId())
                                .projectName(project.getName())
                                .percentage(a.getPercentage())
                                .fromDate(a.getFromDate())
                                .toDate(a.getToDate())
                                .build();
                    })
                    .toList();
            throw new OverAllocationException(existingTotal, totalWouldBe, breakdown);
        }
    }
}
