package com.nexuspm.report;

import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.report.dto.EmOrgBreakdownRow;
import com.nexuspm.report.dto.EmOrgEngineerItem;
import com.nexuspm.report.dto.OrgBreakdownProjectItem;
import com.nexuspm.report.dto.OrgWorkforceSummary;
import com.nexuspm.report.dto.VpOrgBreakdownRow;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.teamroster.repository.TeamManagementRepository;
import com.nexuspm.user.EmployeeRosterRefs;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.nexuspm.report.ManagementHierarchyUtils.*;

@Service
@RequiredArgsConstructor
public class OrgWorkforceService {

    private final TeamManagementRepository managementRepository;
    private final EmployeeRepository employeeRepository;
    private final ProjectRepository projectRepository;

    @Transactional(readOnly = true)
    public OrgWorkforceSummary buildSummary() {
        List<TeamManagement> management = activeManagement();
        long cxoCount = management.stream()
                .filter(person -> isCxoRole(person.getRoleTitle()))
                .count();
        long vpCount = management.stream()
                .filter(person -> isVpRole(person.getRoleTitle()))
                .count();
        long engineeringManagers = management.stream()
                .filter(person -> isEngineeringManagerRole(person.getRoleTitle()))
                .count();
        long employeeCount = employeeRepository.countActiveRosterEmployees();

        return OrgWorkforceSummary.builder()
                .employeeCount(employeeCount)
                .cxoCount(cxoCount)
                .vpCount(vpCount)
                .engineeringManagerCount(engineeringManagers)
                .projectCount(projectRepository.countNonArchived())
                .build();
    }

    @Transactional(readOnly = true)
    public List<VpOrgBreakdownRow> buildVpBreakdown() {
        List<TeamManagement> management = activeManagement();
        if (management.isEmpty()) {
            return List.of();
        }

        Map<UUID, TeamManagement> byId = indexById(management);
        Map<String, TeamManagement> byName = indexByName(management);
        Map<UUID, List<TeamManagement>> childrenBySupervisor =
                childrenBySupervisor(management, byId, byName);
        Map<UUID, Long> engineersByManagerId = rosterCountByEngineeringManagerId();

        List<TeamManagement> vps = management.stream()
                .filter(person -> isVpRole(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        return vps.stream()
                .map(vp -> toVpRow(vp, management, childrenBySupervisor, engineersByManagerId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EmOrgBreakdownRow> buildEmBreakdown() {
        List<TeamManagement> management = activeManagement();
        if (management.isEmpty()) {
            return List.of();
        }

        List<Employee> engineers = employeeRepository.findActiveEngineersWithManager();
        return management.stream()
                .filter(person -> isEngineeringManagerRole(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(em -> toEmRow(em, engineers))
                .toList();
    }

    private List<TeamManagement> activeManagement() {
        return managementRepository.findAll().stream()
                .filter(person -> "ACTIVE".equalsIgnoreCase(person.getStatus()))
                .toList();
    }

    private Map<UUID, Long> rosterCountByEngineeringManagerId() {
        Map<UUID, Long> counts = new HashMap<>();
        for (Employee employee : employeeRepository.findActiveEngineersWithManager()) {
            UUID managerId = employee.getEngineeringManagerManagement() != null
                    ? employee.getEngineeringManagerManagement().getId()
                    : null;
            if (managerId == null) {
                continue;
            }
            counts.merge(managerId, 1L, Long::sum);
        }
        return counts;
    }

    private VpOrgBreakdownRow toVpRow(
            TeamManagement vp,
            List<TeamManagement> management,
            Map<UUID, List<TeamManagement>> childrenBySupervisor,
            Map<UUID, Long> engineersByManagerName) {
        Set<UUID> descendantIds = collectDescendantIds(vp.getId(), childrenBySupervisor);

        List<TeamManagement> emsUnderVp = management.stream()
                .filter(person -> descendantIds.contains(person.getId()))
                .filter(person -> isEngineeringManagerRole(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        long engineerCount = emsUnderVp.stream()
                .mapToLong(em -> engineersByManagerName.getOrDefault(em.getId(), 0L))
                .sum();

        List<EmOrgEngineerItem> engineeringManagers = emsUnderVp.stream()
                .map(em -> EmOrgEngineerItem.builder()
                        .name(em.getFullName())
                        .designation(em.getRoleTitle())
                        .build())
                .toList();
        List<UUID> emIds = emsUnderVp.stream().map(TeamManagement::getId).toList();
        List<OrgBreakdownProjectItem> projects = emIds.isEmpty()
                ? List.of()
                : projectRepository.findBreakdownProjectsByEngineeringManagerIds(emIds);

        return VpOrgBreakdownRow.builder()
                .vpId(vp.getId())
                .vpName(vp.getFullName())
                .engineeringManagerCount(emsUnderVp.size())
                .engineerCount(engineerCount)
                .projectCount(projects.size())
                .engineeringManagers(engineeringManagers)
                .projects(projects)
                .build();
    }

    private EmOrgBreakdownRow toEmRow(TeamManagement em, List<Employee> engineers) {
        List<Employee> team = engineersForManager(em, engineers);
        List<EmOrgEngineerItem> engineerItems = team.stream()
                .map(employee -> EmOrgEngineerItem.builder()
                        .name(employee.getFullName())
                        .designation(designationLabel(employee))
                        .build())
                .toList();
        List<OrgBreakdownProjectItem> projects =
                projectRepository.findBreakdownProjectsByEngineeringManagerManagementId(em.getId());

        return EmOrgBreakdownRow.builder()
                .emId(em.getId())
                .emName(em.getFullName())
                .engineerCount(engineerItems.size())
                .projectCount(projects.size())
                .engineers(engineerItems)
                .projects(projects)
                .build();
    }

    private List<Employee> engineersForManager(TeamManagement em, List<Employee> engineers) {
        List<Employee> matches = new ArrayList<>();
        for (Employee employee : engineers) {
            TeamManagement emMgmt = employee.getEngineeringManagerManagement();
            if (emMgmt != null && emMgmt.getId().equals(em.getId())) {
                matches.add(employee);
            }
        }
        matches.sort(Comparator.comparing(Employee::getFullName, String.CASE_INSENSITIVE_ORDER));
        return matches;
    }

    private String designationLabel(Employee employee) {
        String label = EmployeeRosterRefs.designationName(employee);
        return label != null ? label : "—";
    }
}
