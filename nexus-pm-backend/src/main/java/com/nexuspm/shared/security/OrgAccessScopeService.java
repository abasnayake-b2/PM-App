package com.nexuspm.shared.security;

import com.nexuspm.report.ManagementHierarchyUtils;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.teamroster.repository.TeamManagementRepository;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrgAccessScopeService {

    /** Dummy id so JPQL {@code IN :emManagementIds} is never empty when scope is off. */
    public static final UUID EMPTY_EM_SCOPE_ID = UUID.fromString("00000000-0000-0000-0000-000000000000");

    private final EmployeeRepository employeeRepository;
    private final TeamManagementRepository teamManagementRepository;

    @Transactional(readOnly = true)
    public ProjectAccessScope resolveCurrent() {
        if (SecurityUtils.isAdmin()) {
            return ProjectAccessScope.admin(SecurityUtils.currentUserId());
        }
        return resolve(SecurityUtils.currentUserId());
    }

    @Transactional(readOnly = true)
    public ProjectAccessScope resolve(UUID employeeId) {
        Employee employee = employeeRepository.findDetailedById(employeeId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));

        UUID teamManagementId = employee.getTeamManagement() != null
                ? employee.getTeamManagement().getId()
                : null;
        String managerFullName = employee.getFullName();
        String role = employee.getPrimaryRoleCode();

        return switch (role) {
            case "CXO", "CTO" -> new ProjectAccessScope(
                    employeeId, teamManagementId, managerFullName, false, true, false, List.of(EMPTY_EM_SCOPE_ID));
            case "VP", "VP_ENG" -> {
                List<UUID> emIds = teamManagementId != null
                        ? findEngineeringManagerIdsUnder(teamManagementId)
                        : List.of();
                boolean vpEmScope = !emIds.isEmpty();
                yield new ProjectAccessScope(
                        employeeId,
                        teamManagementId,
                        managerFullName,
                        false,
                        employee.isOrgWideVisibility(),
                        vpEmScope,
                        vpEmScope ? emIds : List.of(EMPTY_EM_SCOPE_ID));
            }
            case "MANAGER", "SEM", "SR_SEM", "PM", "PROJECT_MANAGER", "DM", "DELIVERY_MANAGER" ->
                    new ProjectAccessScope(
                            employeeId,
                            teamManagementId,
                            managerFullName,
                            false,
                            employee.isOrgWideVisibility(),
                            false,
                            List.of(EMPTY_EM_SCOPE_ID));
            // Engineers / employees: see the same project portfolio as their Engineering Manager.
            default -> {
                var em = employee.getEngineeringManagerManagement();
                UUID emManagementId = em != null ? em.getId() : null;
                String emFullName = em != null ? em.getFullName() : null;
                yield new ProjectAccessScope(
                        employeeId,
                        emManagementId,
                        emFullName,
                        false,
                        false,
                        false,
                        List.of(EMPTY_EM_SCOPE_ID));
            }
        };
    }

    @Transactional(readOnly = true)
    public List<String> engineeringManagerNamesUnderVp(UUID vpManagementId) {
        List<UUID> emIds = findEngineeringManagerIdsUnder(vpManagementId);
        if (emIds.isEmpty()) {
            return List.of();
        }
        return teamManagementRepository.findAllById(emIds).stream()
                .map(TeamManagement::getFullName)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UUID> findEngineeringManagerIdsUnder(UUID rootManagementId) {
        if (rootManagementId == null) {
            return List.of();
        }
        List<TeamManagement> management = teamManagementRepository.findAll();
        Map<UUID, List<TeamManagement>> childrenBySupervisor = new HashMap<>();
        for (TeamManagement person : management) {
            if (person.getSupervisor() == null) {
                continue;
            }
            UUID supervisorId = person.getSupervisor().getId();
            childrenBySupervisor.computeIfAbsent(supervisorId, ignored -> new ArrayList<>()).add(person);
        }

        Set<UUID> emIds = new LinkedHashSet<>();
        Set<UUID> visited = new HashSet<>();
        ArrayDeque<UUID> queue = new ArrayDeque<>();
        queue.add(rootManagementId);

        while (!queue.isEmpty()) {
            UUID currentId = queue.removeFirst();
            if (!visited.add(currentId)) {
                continue;
            }
            for (TeamManagement child : childrenBySupervisor.getOrDefault(currentId, List.of())) {
                if (isEngineeringManagerTitle(child.getRoleTitle())) {
                    emIds.add(child.getId());
                }
                queue.addLast(child.getId());
            }
        }
        return List.copyOf(emIds);
    }

    private static boolean isEngineeringManagerTitle(String roleTitle) {
        return ManagementHierarchyUtils.isEngineeringManagerRole(roleTitle);
    }
}
