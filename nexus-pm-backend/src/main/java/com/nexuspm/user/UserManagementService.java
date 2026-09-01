package com.nexuspm.user;

import com.nexuspm.auth.AuthService;
import com.nexuspm.auth.entity.UserAuth;
import com.nexuspm.auth.repository.RefreshTokenRepository;
import com.nexuspm.auth.repository.UserAuthRepository;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.teamroster.TeamRosterService;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.teamroster.repository.TeamManagementRepository;
import com.nexuspm.user.dto.*;
import com.nexuspm.user.entity.Department;
import com.nexuspm.user.entity.Designation;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.entity.Role;
import com.nexuspm.user.repository.DepartmentRepository;
import com.nexuspm.user.repository.DesignationRepository;
import com.nexuspm.user.repository.EmployeeRepository;
import com.nexuspm.user.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserManagementService {

    private final UserAuthRepository userAuthRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final EmployeeRepository employeeRepository;
    private final TeamManagementRepository managementRepository;
    private final TeamRosterService teamRosterService;
    private final DepartmentRepository departmentRepository;
    private final DesignationRepository designationRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final OrgHierarchyService orgHierarchyService;

    private static final Set<String> VISIBILITY_TOGGLE_ROLES = Set.of(
            "MANAGER", "SEM", "SR_SEM",
            "PM", "PROJECT_MANAGER", "DM", "DELIVERY_MANAGER",
            "VP", "VP_ENG");
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<UserAccountResponse> listUserAccounts(String search) {
        String term = search != null && !search.isBlank() ? search.trim() : null;
        return userAuthRepository.findAllWithEmployee(term).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EligibleManagementOption> listEligibleManagement(String search) {
        String term = search != null && !search.isBlank() ? search.trim() : null;
        return managementRepository.findEligibleForUserAccount(term).stream()
                .map(this::toEligibleOption)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EligibleEmployeeOption> listEligibleEmployees(String search) {
        String term = search != null && !search.isBlank() ? search.trim() : null;
        return employeeRepository.findEligibleForUserAccount(term).stream()
                .map(this::toEligibleEmployeeOption)
                .toList();
    }

    @Transactional(readOnly = true)
    public UserAccountResponse getUserAccount(UUID employeeId) {
        UserAuth auth = userAuthRepository.findByEmployeeId(employeeId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "User account not found", 404));
        return toResponse(auth);
    }

    @Transactional
    public UserAccountResponse createUserAccount(CreateUserAccountRequest request) {
        boolean hasManagement = request.getManagementId() != null;
        boolean hasEmployee = request.getEmployeeId() != null;
        if (hasManagement == hasEmployee) {
            throw new BusinessException(
                    "VALIDATION",
                    "Provide exactly one of managementId or employeeId",
                    400);
        }

        Set<Role> roles = resolveRoles(request.getRoleCodes(), request.getRoleCode());
        Role primary = pickPrimaryRole(roles);

        if (hasManagement) {
            return createFromManagement(request, roles, primary);
        }
        return createFromEmployee(request, roles, primary);
    }

    private UserAccountResponse createFromManagement(
            CreateUserAccountRequest request, Set<Role> roles, Role primary) {
        TeamManagement management = managementRepository.findById(request.getManagementId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Management record not found", 404));
        if (!"ACTIVE".equalsIgnoreCase(management.getStatus())) {
            throw new BusinessException("VALIDATION", "Management record is not active", 400);
        }
        if (employeeRepository.existsByTeamManagementId(management.getId())) {
            throw new BusinessException("ALREADY_LINKED", "This management person already has a login account", 400);
        }
        if (employeeRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("EMAIL_EXISTS", "Email already registered", 400);
        }

        Employee employee = new Employee();
        employee.setId(UUID.randomUUID());
        employee.setEmail(request.getEmail().toLowerCase());
        employee.setFirstName(management.getFirstName());
        employee.setLastName(management.getLastName());
        employee.setStatus("ACTIVE");
        employee.setRoles(new LinkedHashSet<>(roles));
        employee.setTeamManagement(management);

        applyDepartment(employee, request.getDepartmentId());
        applyDesignation(employee, request.getDesignationId());
        applyManager(employee, request.getManagerId(), primary, management);
        applyOrgWideVisibility(employee, request.getOrgWideVisibility());

        employeeRepository.save(employee);
        createAuth(employee, request.getPassword());
        return getUserAccount(employee.getId());
    }

    private UserAccountResponse createFromEmployee(
            CreateUserAccountRequest request, Set<Role> roles, Role primary) {
        Employee employee = employeeRepository.findDetailedById(request.getEmployeeId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
        if (userAuthRepository.existsByEmployeeId(employee.getId())) {
            throw new BusinessException("ALREADY_LINKED", "This employee already has a login account", 400);
        }
        if (!"ACTIVE".equalsIgnoreCase(employee.getStatus())) {
            throw new BusinessException("VALIDATION", "Employee is not active", 400);
        }

        String email = request.getEmail().toLowerCase().trim();
        if (!email.equalsIgnoreCase(employee.getEmail()) && employeeRepository.existsByEmail(email)) {
            throw new BusinessException("EMAIL_EXISTS", "Email already registered", 400);
        }

        employee.setEmail(email);
        employee.setRoles(new LinkedHashSet<>(roles));
        employee.setStatus("ACTIVE");

        applyDepartment(employee, request.getDepartmentId());
        applyDesignation(employee, request.getDesignationId());
        applyManager(employee, request.getManagerId(), primary, employee.getTeamManagement());
        applyOrgWideVisibility(employee, request.getOrgWideVisibility());

        employeeRepository.save(employee);
        createAuth(employee, request.getPassword());
        return getUserAccount(employee.getId());
    }

    private void createAuth(Employee employee, String password) {
        UserAuth auth = new UserAuth();
        auth.setId(UUID.randomUUID());
        auth.setEmployee(employee);
        AuthService.applyNewPassword(auth, password, passwordEncoder);
        auth.setActive(true);
        auth.setFailedAttempts(0);
        userAuthRepository.save(auth);
    }

    @Transactional
    public UserAccountResponse updateUserAccount(UUID employeeId, UpdateUserAccountRequest request) {
        UserAuth auth = userAuthRepository.findByEmployeeId(employeeId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "User account not found", 404));
        Employee employee = auth.getEmployee();

        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            String email = request.getEmail().toLowerCase().trim();
            if (!email.equalsIgnoreCase(employee.getEmail()) && employeeRepository.existsByEmail(email)) {
                throw new BusinessException("EMAIL_EXISTS", "Email already registered", 400);
            }
            employee.setEmail(email);
        }

        if (request.getStatus() != null) {
            employee.setStatus(request.getStatus());
            auth.setActive("ACTIVE".equalsIgnoreCase(request.getStatus()));
        }

        if (request.getRoleCodes() != null || (request.getRoleCode() != null && !request.getRoleCode().isBlank())) {
            Set<Role> roles = resolveRoles(request.getRoleCodes(), request.getRoleCode());
            employee.getRoles().clear();
            employee.getRoles().addAll(roles);
            syncRosterForRoleChange(employee, roles);
        }

        if (request.getDepartmentId() != null) {
            applyDepartment(employee, request.getDepartmentId());
        }
        if (request.getDesignationId() != null) {
            applyDesignation(employee, request.getDesignationId());
        }
        if (request.getManagerId() != null) {
            String primaryCode = employee.getPrimaryRoleCode();
            Role roleForManagerCheck = roleRepository.findByCodeWithOrgLevel(primaryCode)
                    .orElseThrow(() -> new BusinessException("INVALID_ROLE", "User has no role", 400));
            // Reload management link after possible promote/demote above.
            Employee refreshed = employeeRepository.findDetailedById(employee.getId()).orElse(employee);
            employee.setTeamManagement(refreshed.getTeamManagement());
            applyManager(employee, request.getManagerId(), roleForManagerCheck, employee.getTeamManagement());
        }

        if (request.getOrgWideVisibility() != null
                || request.getRoleCode() != null
                || request.getRoleCodes() != null) {
            Boolean requested = request.getOrgWideVisibility() != null
                    ? request.getOrgWideVisibility()
                    : employee.isOrgWideVisibility();
            applyOrgWideVisibility(employee, requested);
        }

        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            AuthService.applyNewPassword(auth, request.getPassword(), passwordEncoder);
        }

        userAuthRepository.save(auth);
        employeeRepository.save(employee);
        return getUserAccount(employeeId);
    }

    @Transactional
    public void deleteUserAccount(UUID employeeId) {
        UserAuth auth = userAuthRepository.findByEmployeeId(employeeId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "User account not found", 404));
        Employee employee = auth.getEmployee();
        employee.setStatus("INACTIVE");
        auth.setActive(false);
        employeeRepository.save(employee);
        userAuthRepository.save(auth);
    }

    @Transactional
    public UserAccountResponse unlockUserAccount(UUID employeeId) {
        UserAuth auth = userAuthRepository.findByEmployeeId(employeeId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "User account not found", 404));

        boolean wasLocked = isAccountLocked(auth) || auth.getFailedAttempts() > 0;
        if (!wasLocked) {
            throw new BusinessException("NOT_LOCKED", "Account is not locked and has no failed login attempts", 400);
        }

        auth.setFailedAttempts(0);
        auth.setLockedUntil(null);
        userAuthRepository.save(auth);
        refreshTokenRepository.revokeAllForEmployee(employeeId);

        auditLogService.log(
                SecurityUtils.currentUserId(),
                "UNLOCK",
                "USER_AUTH",
                employeeId,
                "Admin unlocked account for " + auth.getEmployee().getEmail(),
                null);

        return getUserAccount(employeeId);
    }

    private static boolean isAccountLocked(UserAuth auth) {
        return auth.getLockedUntil() != null && auth.getLockedUntil().isAfter(Instant.now());
    }

    private void applyDepartment(Employee employee, UUID departmentId) {
        if (departmentId == null) {
            return;
        }
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new BusinessException("INVALID_DEPARTMENT", "Department not found", 400));
        employee.setDepartment(department);
    }

    private void applyDesignation(Employee employee, UUID designationId) {
        if (designationId == null) {
            return;
        }
        Designation designation = designationRepository.findById(designationId)
                .orElseThrow(() -> new BusinessException("INVALID_DESIGNATION", "Designation not found", 400));
        employee.setDesignation(designation);
    }

    private void applyManager(Employee employee, UUID managerId, Role role, TeamManagement management) {
        UUID resolvedManagerId = managerId;
        if (resolvedManagerId == null && management != null && management.getSupervisor() != null) {
            resolvedManagerId = employeeRepository.findByTeamManagementId(management.getSupervisor().getId())
                    .map(Employee::getId)
                    .orElse(null);
        }
        if (resolvedManagerId == null && employee.getManager() != null) {
            resolvedManagerId = employee.getManager().getId();
        }
        if (resolvedManagerId == null && employee.getEngineeringManagerManagement() != null) {
            resolvedManagerId = employeeRepository.findByTeamManagementId(
                            employee.getEngineeringManagerManagement().getId())
                    .map(Employee::getId)
                    .orElse(null);
        }
        if (resolvedManagerId == null) {
            orgHierarchyService.validateManagerAssignment(role, null);
            employee.setManager(null);
            return;
        }
        if (resolvedManagerId.equals(employee.getId())) {
            throw new BusinessException("VALIDATION", "User cannot be their own manager", 400);
        }
        Employee manager = employeeRepository.findDetailedById(resolvedManagerId)
                .orElseThrow(() -> new BusinessException("INVALID_MANAGER", "Manager not found", 400));
        orgHierarchyService.validateManagerAssignment(role, manager);
        employee.setManager(manager);
    }

    private void validateAssignableRole(String roleCode) {
        if (roleCode == null || roleCode.isBlank()) {
            throw new BusinessException("INVALID_ROLE", "Role is required", 400);
        }
        if (roleRepository.findByCode(roleCode.trim().toUpperCase()).isEmpty()) {
            throw new BusinessException("INVALID_ROLE", "Role not found", 400);
        }
    }

    /**
     * Resolve one or more roles from {@code roleCodes} and/or legacy single {@code roleCode}.
     */
    private Set<Role> resolveRoles(List<String> roleCodes, String roleCode) {
        LinkedHashSet<String> codes = new LinkedHashSet<>();
        if (roleCodes != null) {
            for (String code : roleCodes) {
                if (code != null && !code.isBlank()) {
                    codes.add(code.trim().toUpperCase());
                }
            }
        }
        if (roleCode != null && !roleCode.isBlank()) {
            codes.add(roleCode.trim().toUpperCase());
        }
        if (codes.isEmpty()) {
            throw new BusinessException("INVALID_ROLE", "Select at least one application role", 400);
        }

        Set<Role> roles = new LinkedHashSet<>();
        for (String code : codes) {
            validateAssignableRole(code);
            Role role = roleRepository.findByCodeWithOrgLevel(code)
                    .orElseThrow(() -> new BusinessException("INVALID_ROLE", "Role not found: " + code, 400));
            roles.add(role);
        }
        return roles;
    }

    private static Role pickPrimaryRole(Set<Role> roles) {
        // Employee + extra roles (PM, Admin, …) stay at employee org level.
        for (Role role : roles) {
            if (role.getCode() != null && "EMPLOYEE".equalsIgnoreCase(role.getCode())) {
                return role;
            }
        }
        // Prefer org/hierarchy roles over SUPER_ADMIN/ADMIN when multiple are assigned,
        // so adding Super Admin does not wipe the reporting line for VP/Manager/etc.
        List<Role> orgRoles = roles.stream()
                .filter(r -> {
                    String code = r.getCode() != null ? r.getCode().toUpperCase() : "";
                    return !"SUPER_ADMIN".equals(code) && !"ADMIN".equals(code);
                })
                .toList();
        Set<Role> pool = orgRoles.isEmpty() ? roles : new LinkedHashSet<>(orgRoles);
        return pool.stream()
                .min(Comparator.comparingInt(UserManagementService::roleSortOrder))
                .orElseThrow(() -> new BusinessException("INVALID_ROLE", "Select at least one application role", 400));
    }

    private static int roleSortOrder(Role role) {
        if (role.getOrgLevel() != null) {
            return role.getOrgLevel().getLevelOrder();
        }
        return switch (role.getCode()) {
            case "SUPER_ADMIN" -> 0;
            case "ADMIN" -> 1;
            default -> 4;
        };
    }

    /**
     * Keep team_management in sync with hierarchy role:
     * Employee (even with extra permission roles like PM) stays on the employee roster;
     * Manager+ without Employee creates a management row.
     */
    private void syncRosterForRoleChange(Employee employee, Set<Role> roles) {
        boolean staysEmployee = roles.stream()
                .anyMatch(r -> r.getCode() != null && "EMPLOYEE".equalsIgnoreCase(r.getCode()));
        if (staysEmployee) {
            if (employee.getTeamManagement() != null) {
                teamRosterService.removeManagementLink(employee);
            }
            return;
        }
        String newRole = pickPrimaryRole(roles).getCode();
        if (requiresManagementRoster(newRole) && employee.getTeamManagement() == null) {
            teamRosterService.ensureManagementLink(employee, defaultManagementRoleTitle(newRole));
        }
    }

    private static boolean requiresManagementRoster(String roleCode) {
        if (roleCode == null || roleCode.isBlank()) {
            return false;
        }
        return switch (roleCode.trim().toUpperCase()) {
            case "CXO", "CTO", "VP", "VP_ENG", "MANAGER", "SEM", "SR_SEM", "TECH_LEAD",
                 "PM", "PROJECT_MANAGER", "DM", "DELIVERY_MANAGER" -> true;
            default -> false;
        };
    }

    private static String defaultManagementRoleTitle(String roleCode) {
        if (roleCode == null || roleCode.isBlank()) {
            return "Manager";
        }
        return switch (roleCode.trim().toUpperCase()) {
            case "CXO" -> "CXO";
            case "CTO" -> "CTO";
            case "VP", "VP_ENG" -> "VP";
            case "SR_SEM" -> "Senior Engineering Manager";
            case "SEM" -> "Engineering Manager";
            case "TECH_LEAD" -> "Tech Lead";
            case "PM", "PROJECT_MANAGER" -> "Project Manager";
            case "DM", "DELIVERY_MANAGER" -> "Delivery Manager";
            default -> "Manager";
        };
    }

    private UserAccountResponse toResponse(UserAuth auth) {
        Employee employee = auth.getEmployee();
        TeamManagement management = employee.getTeamManagement();
        return UserAccountResponse.builder()
                .id(employee.getId())
                .email(employee.getEmail())
                .firstName(employee.getFirstName())
                .lastName(employee.getLastName())
                .fullName(employee.getFullName())
                .status(employee.getStatus())
                .roleCode(employee.getPrimaryRoleCode())
                .roleCodes(employee.getRoles().stream()
                        .sorted(Comparator.comparingInt(UserManagementService::roleSortOrder))
                        .map(Role::getCode)
                        .collect(Collectors.toCollection(ArrayList::new)))
                .departmentId(employee.getDepartment() != null ? employee.getDepartment().getId() : null)
                .departmentName(employee.getDepartment() != null ? employee.getDepartment().getName() : null)
                .designationId(employee.getDesignation() != null ? employee.getDesignation().getId() : null)
                .designationName(employee.getDesignation() != null ? employee.getDesignation().getName() : null)
                .managerId(employee.getManager() != null ? employee.getManager().getId() : null)
                .managerName(employee.getManager() != null ? employee.getManager().getFullName() : null)
                .managementId(management != null ? management.getId() : null)
                .managementRoleTitle(management != null ? management.getRoleTitle() : null)
                .managementFullName(management != null ? management.getFullName() : null)
                .authActive(auth.isActive())
                .failedLoginAttempts(auth.getFailedAttempts())
                .lockedUntil(auth.getLockedUntil())
                .accountLocked(isAccountLocked(auth))
                .orgWideVisibility(employee.isOrgWideVisibility())
                .build();
    }

    private void applyOrgWideVisibility(Employee employee, Boolean requested) {
        boolean toggleRole = employee.getRoles().stream()
                .map(Role::getCode)
                .filter(code -> code != null && !code.isBlank())
                .map(code -> code.trim().toUpperCase())
                .anyMatch(VISIBILITY_TOGGLE_ROLES::contains);
        if (!toggleRole) {
            employee.setOrgWideVisibility(false);
            return;
        }
        if (requested != null) {
            employee.setOrgWideVisibility(requested);
            return;
        }
        boolean vp = employee.getRoles().stream()
                .map(Role::getCode)
                .anyMatch(code -> "VP".equalsIgnoreCase(code) || "VP_ENG".equalsIgnoreCase(code));
        employee.setOrgWideVisibility(vp);
    }

    private EligibleManagementOption toEligibleOption(TeamManagement management) {
        UUID supervisorEmployeeId = null;
        String supervisorEmployeeName = null;
        if (management.getSupervisor() != null) {
            Optional<Employee> supervisorEmployee = employeeRepository.findByTeamManagementId(
                    management.getSupervisor().getId());
            if (supervisorEmployee.isPresent()) {
                supervisorEmployeeId = supervisorEmployee.get().getId();
                supervisorEmployeeName = supervisorEmployee.get().getFullName();
            }
        }
        return EligibleManagementOption.builder()
                .id(management.getId())
                .roleTitle(management.getRoleTitle())
                .firstName(management.getFirstName())
                .lastName(management.getLastName())
                .fullName(management.getFullName())
                .supervisorName(management.getSupervisor() != null ? management.getSupervisor().getFullName() : null)
                .supervisorFullName(management.getSupervisor() != null ? management.getSupervisor().getFullName() : null)
                .supervisorManagementId(management.getSupervisor() != null ? management.getSupervisor().getId() : null)
                .supervisorEmployeeId(supervisorEmployeeId)
                .supervisorEmployeeName(supervisorEmployeeName)
                .status(management.getStatus())
                .build();
    }

    private EligibleEmployeeOption toEligibleEmployeeOption(Employee employee) {
        TeamManagement management = employee.getTeamManagement();
        UUID departmentId = employee.getDepartment() != null
                ? employee.getDepartment().getId()
                : (employee.getDesignation() != null && employee.getDesignation().getDepartment() != null
                        ? employee.getDesignation().getDepartment().getId()
                        : null);
        String departmentName = employee.getDepartment() != null
                ? employee.getDepartment().getName()
                : (employee.getDesignation() != null && employee.getDesignation().getDepartment() != null
                        ? employee.getDesignation().getDepartment().getName()
                        : null);

        UUID managerId = employee.getManager() != null ? employee.getManager().getId() : null;
        String managerName = employee.getManager() != null ? employee.getManager().getFullName() : null;
        if (managerId == null && employee.getEngineeringManagerManagement() != null) {
            Optional<Employee> emLogin = employeeRepository.findByTeamManagementId(
                    employee.getEngineeringManagerManagement().getId());
            if (emLogin.isPresent()) {
                managerId = emLogin.get().getId();
                managerName = emLogin.get().getFullName();
            }
        }

        return EligibleEmployeeOption.builder()
                .id(employee.getId())
                .firstName(employee.getFirstName())
                .lastName(employee.getLastName())
                .fullName(employee.getFullName())
                .email(employee.getEmail())
                .departmentId(departmentId)
                .departmentName(departmentName)
                .designationId(employee.getDesignation() != null ? employee.getDesignation().getId() : null)
                .designationName(employee.getDesignation() != null ? employee.getDesignation().getName() : null)
                .managerId(managerId)
                .managerName(managerName)
                .engineeringManagerName(employee.getEngineeringManagerManagement() != null
                        ? employee.getEngineeringManagerManagement().getFullName()
                        : null)
                .managementId(management != null ? management.getId() : null)
                .managementRoleTitle(management != null ? management.getRoleTitle() : null)
                .status(employee.getStatus())
                .build();
    }
}
