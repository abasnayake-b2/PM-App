package com.nexuspm.user;

import com.nexuspm.auth.AuthService;
import com.nexuspm.auth.entity.UserAuth;
import com.nexuspm.auth.repository.RefreshTokenRepository;
import com.nexuspm.auth.repository.UserAuthRepository;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
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
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserManagementService {

    private final UserAuthRepository userAuthRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final EmployeeRepository employeeRepository;
    private final TeamManagementRepository managementRepository;
    private final DepartmentRepository departmentRepository;
    private final DesignationRepository designationRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final OrgHierarchyService orgHierarchyService;
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
    public UserAccountResponse getUserAccount(UUID employeeId) {
        UserAuth auth = userAuthRepository.findByEmployeeId(employeeId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "User account not found", 404));
        return toResponse(auth);
    }

    @Transactional
    public UserAccountResponse createUserAccount(CreateUserAccountRequest request) {
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

        validateAssignableRole(request.getRoleCode());
        Role role = roleRepository.findByCodeWithOrgLevel(request.getRoleCode())
                .orElseThrow(() -> new BusinessException("INVALID_ROLE", "Role not found", 400));

        Employee employee = new Employee();
        employee.setId(UUID.randomUUID());
        employee.setEmail(request.getEmail().toLowerCase());
        employee.setFirstName(management.getFirstName());
        employee.setLastName(management.getLastName());
        employee.setStatus("ACTIVE");
        employee.setRoles(Set.of(role));
        employee.setTeamManagement(management);

        applyDepartment(employee, request.getDepartmentId());
        applyDesignation(employee, request.getDesignationId());
        applyManager(employee, request.getManagerId(), role, management);
        applyOrgWideVisibility(employee, role.getCode(), request.getOrgWideVisibility());

        employeeRepository.save(employee);

        UserAuth auth = new UserAuth();
        auth.setId(UUID.randomUUID());
        auth.setEmployee(employee);
        AuthService.applyNewPassword(auth, request.getPassword(), passwordEncoder);
        auth.setActive(true);
        auth.setFailedAttempts(0);
        userAuthRepository.save(auth);

        return getUserAccount(employee.getId());
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

        if (request.getRoleCode() != null && !request.getRoleCode().isBlank()) {
            validateAssignableRole(request.getRoleCode());
            Role role = roleRepository.findByCodeWithOrgLevel(request.getRoleCode().trim().toUpperCase())
                    .orElseThrow(() -> new BusinessException("INVALID_ROLE", "Role not found", 400));
            employee.getRoles().clear();
            employee.getRoles().add(role);
        }

        if (request.getDepartmentId() != null) {
            applyDepartment(employee, request.getDepartmentId());
        }
        if (request.getDesignationId() != null) {
            applyDesignation(employee, request.getDesignationId());
        }
        if (request.getManagerId() != null) {
            Role primaryRole = employee.getRoles().stream().findFirst()
                    .orElseThrow(() -> new BusinessException("INVALID_ROLE", "User has no role", 400));
            // Ensure org-level graph is loaded for hierarchy checks after a role change.
            Role roleForManagerCheck = roleRepository.findByCodeWithOrgLevel(primaryRole.getCode())
                    .orElse(primaryRole);
            applyManager(employee, request.getManagerId(), roleForManagerCheck, employee.getTeamManagement());
        }

        if (request.getOrgWideVisibility() != null || request.getRoleCode() != null) {
            String roleCode = employee.getPrimaryRoleCode();
            Boolean requested = request.getOrgWideVisibility() != null
                    ? request.getOrgWideVisibility()
                    : employee.isOrgWideVisibility();
            applyOrgWideVisibility(employee, roleCode, requested);
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

    private void applyOrgWideVisibility(Employee employee, String roleCode, Boolean requested) {
        String code = roleCode == null ? "" : roleCode.trim().toUpperCase();
        boolean toggleRole = Set.of("MANAGER", "SEM", "SR_SEM", "VP", "VP_ENG").contains(code);
        if (!toggleRole) {
            employee.setOrgWideVisibility(false);
            return;
        }
        if (requested != null) {
            employee.setOrgWideVisibility(requested);
            return;
        }
        // Defaults: VP org-wide, Manager own-team
        employee.setOrgWideVisibility("VP".equals(code) || "VP_ENG".equals(code));
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
}
