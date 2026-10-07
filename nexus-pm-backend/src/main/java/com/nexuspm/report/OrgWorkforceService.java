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
import static com.nexuspm.report.ManagementHierarchyUtils.OrgPillar;

@Service
@RequiredArgsConstructor
public class OrgWorkforceService {

    private final TeamManagementRepository managementRepository;
    private final EmployeeRepository employeeRepository;
    private final ProjectRepository projectRepository;

    @Transactional(readOnly = true)
    public OrgWorkforceSummary buildSummary() {
        List<TeamManagement> management = activeManagement();
        List<EmOrgEngineerItem> engineeringManagers = management.stream()
                .filter(person -> isEngineeringManagerRole(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toManagementItem)
                .toList();
        List<EmOrgEngineerItem> deliveryManagers = management.stream()
                .filter(person -> isDeliveryManagerRole(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toManagementItem)
                .toList();
        List<EmOrgEngineerItem> coeManagers = management.stream()
                .filter(person -> isCoeManagerRole(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toManagementItem)
                .toList();

        List<EmOrgEngineerItem> cxoPeople = new ArrayList<>();
        List<EmOrgEngineerItem> vpPeople = new ArrayList<>();
        List<EmOrgEngineerItem> engineeringPeople = new ArrayList<>();
        List<EmOrgEngineerItem> deliveryPeople = new ArrayList<>();
        List<EmOrgEngineerItem> coePeople = new ArrayList<>();
        for (TeamManagement person : management) {
            EmOrgEngineerItem item = toManagementItem(person);
            switch (pillarFromRoleTitle(person.getRoleTitle())) {
                case CXO -> cxoPeople.add(item);
                case VP -> vpPeople.add(item);
                case DELIVERY -> deliveryPeople.add(item);
                case COE -> coePeople.add(item);
                case ENGINEERING -> engineeringPeople.add(item);
            }
        }

        for (Employee employee : employeeRepository.findActiveRosterEmployees()) {
            EmOrgEngineerItem item = EmOrgEngineerItem.builder()
                    .name(employee.getFullName())
                    .designation(designationLabel(employee))
                    .build();
            switch (pillarForEmployee(employee)) {
                case CXO -> cxoPeople.add(item);
                case VP -> vpPeople.add(item);
                case DELIVERY -> deliveryPeople.add(item);
                case COE -> coePeople.add(item);
                case ENGINEERING -> engineeringPeople.add(item);
            }
        }

        cxoPeople = sortPeople(cxoPeople);
        vpPeople = sortPeople(vpPeople);
        engineeringPeople = sortPeople(engineeringPeople);
        deliveryPeople = sortPeople(deliveryPeople);
        coePeople = sortPeople(coePeople);

        List<EmOrgEngineerItem> employees = new ArrayList<>();
        employees.addAll(cxoPeople);
        employees.addAll(vpPeople);
        employees.addAll(engineeringPeople);
        employees.addAll(deliveryPeople);
        employees.addAll(coePeople);
        employees = sortPeople(employees);

        List<OrgBreakdownProjectItem> projects = projectRepository.findAllBreakdownProjectsNonArchived();

        return OrgWorkforceSummary.builder()
                .employeeCount(employees.size())
                .cxoCount(cxoPeople.size())
                .vpCount(vpPeople.size())
                .engineeringCount(engineeringPeople.size())
                .deliveryCount(deliveryPeople.size())
                .coeCount(coePeople.size())
                .engineeringManagerCount(engineeringManagers.size())
                .deliveryManagerCount(deliveryManagers.size())
                .coeManagerCount(coeManagers.size())
                .projectCount(projects.size())
                .employees(employees)
                .cxos(cxoPeople)
                .vps(vpPeople)
                .engineering(engineeringPeople)
                .delivery(deliveryPeople)
                .coe(coePeople)
                .engineeringManagers(engineeringManagers)
                .deliveryManagers(deliveryManagers)
                .coeManagers(coeManagers)
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
        return buildManagerBreakdown(ManagementHierarchyUtils::isEngineeringManagerRole);
    }

    @Transactional(readOnly = true)
    public List<EmOrgBreakdownRow> buildDmBreakdown() {
        return buildManagerBreakdown(ManagementHierarchyUtils::isDeliveryManagerRole);
    }

    @Transactional(readOnly = true)
    public List<EmOrgBreakdownRow> buildCoeBreakdown() {
        return buildManagerBreakdown(ManagementHierarchyUtils::isCoeManagerRole);
    }

    private List<EmOrgBreakdownRow> buildManagerBreakdown(
            java.util.function.Predicate<String> roleMatch) {
        List<TeamManagement> management = activeManagement();
        if (management.isEmpty()) {
            return List.of();
        }

        List<Employee> engineers = employeeRepository.findActiveEngineersWithManager();
        return management.stream()
                .filter(person -> roleMatch.test(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(manager -> toEmRow(manager, engineers))
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
        List<TeamManagement> dmsUnderVp = management.stream()
                .filter(person -> descendantIds.contains(person.getId()))
                .filter(person -> isDeliveryManagerRole(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        List<TeamManagement> coesUnderVp = management.stream()
                .filter(person -> descendantIds.contains(person.getId()))
                .filter(person -> isCoeManagerRole(person.getRoleTitle()))
                .sorted(Comparator.comparing(TeamManagement::getFullName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        List<EmOrgEngineerItem> engineeringManagers = emsUnderVp.stream()
                .map(this::toManagementItem)
                .toList();
        List<EmOrgEngineerItem> deliveryManagers = dmsUnderVp.stream()
                .map(this::toManagementItem)
                .toList();
        List<EmOrgEngineerItem> coeManagers = coesUnderVp.stream()
                .map(this::toManagementItem)
                .toList();

        List<TeamManagement> managersUnderVp = new ArrayList<>();
        managersUnderVp.addAll(emsUnderVp);
        managersUnderVp.addAll(dmsUnderVp);
        managersUnderVp.addAll(coesUnderVp);

        List<EmOrgEngineerItem> engineerItems = new ArrayList<>();
        for (TeamManagement manager : managersUnderVp) {
            for (Employee employee : engineersForManager(manager, engineers)) {
                engineerItems.add(EmOrgEngineerItem.builder()
                        .name(employee.getFullName())
                        .designation(designationLabel(employee))
                        .build());
            }
        }
        engineerItems.sort(Comparator.comparing(EmOrgEngineerItem::getName, String.CASE_INSENSITIVE_ORDER));

        List<UUID> managerIds = managersUnderVp.stream().map(TeamManagement::getId).toList();
        List<OrgBreakdownProjectItem> projects = managerIds.isEmpty()
                ? List.of()
                : projectRepository.findBreakdownProjectsByEngineeringManagerIds(managerIds);

        return VpOrgBreakdownRow.builder()
                .vpId(vp.getId())
                .vpName(vp.getFullName())
                .engineeringManagerCount(emsUnderVp.size())
                .deliveryManagerCount(dmsUnderVp.size())
                .coeManagerCount(coesUnderVp.size())
                .engineerCount(engineerItems.size())
                .projectCount(projects.size())
                .engineeringManagers(engineeringManagers)
                .deliveryManagers(deliveryManagers)
                .coeManagers(coeManagers)
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

    private OrgPillar pillarForEmployee(Employee employee) {
        OrgPillar own = pillarFromOwnTitle(employee);
        if (own != OrgPillar.ENGINEERING) {
            return own;
        }
        TeamManagement manager = employee.getEngineeringManagerManagement();
        if (manager == null) {
            return OrgPillar.ENGINEERING;
        }
        OrgPillar managerPillar = pillarFromRoleTitle(manager.getRoleTitle());
        // ICs reporting to a VP still sit in Engineering, not the VP row.
        return managerPillar == OrgPillar.VP ? OrgPillar.ENGINEERING : managerPillar;
    }

    private OrgPillar pillarFromOwnTitle(Employee employee) {
        String name = EmployeeRosterRefs.designationName(employee);
        if (name != null && !name.isBlank()) {
            OrgPillar fromName = pillarFromRoleTitle(name);
            if (fromName != OrgPillar.ENGINEERING) {
                return fromName;
            }
        }
        String code = EmployeeRosterRefs.designationCode(employee);
        if (code != null && !code.isBlank()) {
            return pillarFromRoleTitle(code);
        }
        return OrgPillar.ENGINEERING;
    }

    private List<EmOrgEngineerItem> sortPeople(List<EmOrgEngineerItem> people) {
        return people.stream()
                .sorted(Comparator.comparing(EmOrgEngineerItem::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }
}
