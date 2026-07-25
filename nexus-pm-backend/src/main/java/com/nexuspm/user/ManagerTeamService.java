package com.nexuspm.user;

import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ManagerTeamService {

    private final EmployeeRepository employeeRepository;

    @Transactional(readOnly = true)
    public List<Employee> resolveTeam(UUID managerEmployeeId) {
        return employeeRepository.findDetailedById(managerEmployeeId)
                .map(this::resolveTeam)
                .orElse(List.of());
    }

    @Transactional(readOnly = true)
    public List<Employee> resolveTeam(Employee manager) {
        String role = manager.getPrimaryRoleCode();
        if ("CXO".equals(role) || "CTO".equals(role)) {
            return employeeRepository.findActiveRosterFiltered(null, null, null, null);
        }
        if (("VP".equals(role) || "VP_ENG".equals(role)
                || "MANAGER".equals(role) || "SEM".equals(role) || "SR_SEM".equals(role)
                || "PM".equals(role) || "PROJECT_MANAGER".equals(role)
                || "DM".equals(role) || "DELIVERY_MANAGER".equals(role))
                && manager.isOrgWideVisibility()) {
            return employeeRepository.findActiveRosterFiltered(null, null, null, null);
        }
        return resolveTeamDefault(manager);
    }

    private List<Employee> resolveTeamDefault(Employee viewer) {
        Map<UUID, Employee> teamById = new LinkedHashMap<>();
        teamById.put(viewer.getId(), viewer);
        employeeRepository.findDirectReports(viewer.getId())
                .forEach(member -> teamById.put(member.getId(), member));

        // Managers: people under their own management node.
        UUID managementId = viewer.getTeamManagement() != null ? viewer.getTeamManagement().getId() : null;
        // Engineers: peers under the same Engineering Manager.
        if (managementId == null && viewer.getEngineeringManagerManagement() != null) {
            managementId = viewer.getEngineeringManagerManagement().getId();
        }
        if (managementId != null) {
            employeeRepository.findByEngineeringManagerManagementId(managementId)
                    .forEach(member -> teamById.putIfAbsent(member.getId(), member));
        }
        return List.copyOf(teamById.values());
    }
}
