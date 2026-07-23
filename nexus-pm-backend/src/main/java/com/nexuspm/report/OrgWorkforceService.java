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
        List<EmOrgEngineerItem> cxos = management.stream()
                .filter(person -> isCxoRole(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toManagementItem)
                .toList();
        List<EmOrgEngineerItem> vps = management.stream()
                .filter(person -> isVpRole(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toManagementItem)
                .toList();
        List<EmOrgEngineerItem> engineeringManagers = management.stream()
                .filter(person -> isEngineeringManagerRole(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toManagementItem)
                .toList();
        List<EmOrgEngineerItem> employees = employeeRepository.findActiveRosterEmployees().stream()
                .map(employee -> EmOrgEngineerItem.builder()
                        .name(employee.getFullName())
                        .designation(designationLabel(employee))
                        .build())
                .toList();
        List<OrgBreakdownProjectItem> projects = projectRepository.findAllBreakdownProjectsNonArchived();

        return OrgWorkforceSummary.builder()
                .employeeCount(employees.size())
                .cxoCount(cxos.size())
                .vpCount(vps.size())
                .engineeringManagerCount(engineeringManagers.size())
                .projectCount(projects.size())
                .employees(employees)
                .cxos(cxos)
                .vps(vps)
                .engineeringManagers(engineeringManagers)
                .projects(projects)
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
        List<Employee> engineers = employeeRepository.findActiveEngineersWithManager();

        List<TeamManagement> vps = management.stream()
                .filter(person -> isVpRole(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        return vps.stream()
                .map(vp -> toVpRow(vp, management, childrenBySupervisor, engineers))
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

    private VpOrgBreakdownRow toVpRow(
            TeamManagement vp,
            List<TeamManagement> management,
            Map<UUID, List<TeamManagement>> childrenBySupervisor,
            List<Employee> engineers) {
        Set<UUID> descendantIds = collectDescendantIds(vp.getId(), childrenBySupervisor);

        List<TeamManagement> emsUnderVp = management.stream()
                .filter(person -> descendantIds.contains(person.getId()))
                .filter(person -> isEngineeringManagerRole(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        List<EmOrgEngineerItem> engineeringManagers = emsUnderVp.stream()
                .map(this::toManagementItem)
                .toList();

        List<EmOrgEngineerItem> engineerItems = new ArrayList<>();
        for (TeamManagement em : emsUnderVp) {
            for (Employee employee : engineersForManager(em, engineers)) {
                engineerItems.add(EmOrgEngineerItem.builder()
                        .name(employee.getFullName())
                        .designation(designationLabel(employee))
                        .build());
            }
        }
        engineerItems.sort(Comparator.comparing(EmOrgEngineerItem::getName, String.CASE_INSENSITIVE_ORDER));

        List<UUID> emIds = emsUnderVp.stream().map(TeamManagement::getId).toList();
        List<OrgBreakdownProjectItem> projects = emIds.isEmpty()
                ? List.of()
                : projectRepository.findBreakdownProjectsByEngineeringManagerIds(emIds);

        return VpOrgBreakdownRow.builder()
                .vpId(vp.getId())
                .vpName(vp.getFullName())
                .engineeringManagerCount(emsUnderVp.size())
                .engineerCount(engineerItems.size())
                .projectCount(projects.size())
                .engineeringManagers(engineeringManagers)
                .engineers(engineerItems)
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

    private EmOrgEngineerItem toManagementItem(TeamManagement person) {
        return EmOrgEngineerItem.builder()
                .name(person.getFullName())
                .designation(person.getRoleTitle() != null ? person.getRoleTitle() : "—")
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
