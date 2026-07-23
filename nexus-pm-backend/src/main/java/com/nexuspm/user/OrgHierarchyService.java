package com.nexuspm.user;

import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.user.dto.OrgLevelResponse;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.entity.OrgLevel;
import com.nexuspm.user.entity.Role;
import com.nexuspm.user.repository.OrgLevelRepository;
import com.nexuspm.shared.cache.CacheNames;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class OrgHierarchyService {

    private final OrgLevelRepository orgLevelRepository;

    @Cacheable(cacheNames = CacheNames.ORG_LEVELS, key = "'all'")
    @Transactional(readOnly = true)
    public List<OrgLevelResponse> listOrgLevels() {
        return orgLevelRepository.findAllOrdered().stream()
                .map(level -> OrgLevelResponse.builder()
                        .id(level.getId())
                        .code(level.getCode())
                        .name(level.getName())
                        .levelOrder(level.getLevelOrder())
                        .reportsToCode(level.getReportsToOrgLevel() != null
                                ? level.getReportsToOrgLevel().getCode()
                                : null)
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public void validateManagerAssignment(Role employeeRole, Employee manager) {
        OrgLevel employeeLevel = employeeRole.getOrgLevel();
        if (employeeLevel == null) {
            // App-only roles (Super Admin / Admin) are outside the org reporting line.
            return;
        }

        if (employeeLevel.getReportsToOrgLevel() == null) {
            if (manager != null) {
                throw new BusinessException(
                        "INVALID_MANAGER",
                        employeeLevel.getName() + " cannot have a supervisor",
                        400);
            }
            return;
        }

        if (manager == null) {
            throw new BusinessException(
                    "INVALID_MANAGER",
                    employeeLevel.getName() + " must report to a "
                            + employeeLevel.getReportsToOrgLevel().getName()
                            + " (or more senior)",
                    400);
        }

        OrgLevel requiredSupervisorLevel = employeeLevel.getReportsToOrgLevel();
        Optional<OrgLevel> actualSupervisorLevel = resolveOrgLevel(manager);

        // Super Admin / Admin (no org level) may supervise any org role.
        if (actualSupervisorLevel.isEmpty()) {
            boolean adminSupervisor = manager.getRoles().stream()
                    .anyMatch(role -> role.getOrgLevel() == null);
            if (adminSupervisor) {
                return;
            }
            throw new BusinessException(
                    "INVALID_MANAGER",
                    "Supervisor must have an organisation role at or above "
                            + requiredSupervisorLevel.getName(),
                    400);
        }

        // Accept exact required level or any more senior level (lower level_order).
        if (actualSupervisorLevel.get().getLevelOrder() > requiredSupervisorLevel.getLevelOrder()) {
            throw new BusinessException(
                    "INVALID_MANAGER",
                    employeeLevel.getName() + " must report to a "
                            + requiredSupervisorLevel.getName()
                            + " or more senior role, not "
                            + actualSupervisorLevel.get().getName(),
                    400);
        }
    }

    public Optional<String> resolveOrgLevelCode(Employee employee) {
        return resolveOrgLevel(employee).map(OrgLevel::getCode);
    }

    private Optional<OrgLevel> resolveOrgLevel(Employee employee) {
        return employee.getRoles().stream()
                .map(Role::getOrgLevel)
                .filter(level -> level != null)
                .min(Comparator.comparingInt(OrgLevel::getLevelOrder));
    }
}
