package com.nexuspm.user;

import com.nexuspm.auth.AuthService;
import com.nexuspm.auth.entity.UserAuth;
import com.nexuspm.auth.repository.UserAuthRepository;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.user.dto.*;
import com.nexuspm.user.entity.Department;
import com.nexuspm.user.entity.Designation;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.entity.Role;
import com.nexuspm.user.mapper.EmployeeMapper;
import com.nexuspm.user.repository.DepartmentRepository;
import com.nexuspm.user.repository.DesignationRepository;
import com.nexuspm.user.repository.EmployeeRepository;
import com.nexuspm.user.repository.RoleRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final DesignationRepository designationRepository;
    private final RoleRepository roleRepository;
    private final UserAuthRepository userAuthRepository;
    private final EmployeeMapper employeeMapper;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;
    private final OrgHierarchyService orgHierarchyService;

    @Transactional(readOnly = true)
    public Page<EmployeeResponse> listEmployees(String search, Pageable pageable) {
        String term = search != null && !search.isBlank() ? search.trim() : null;
        return employeeRepository
                .findFiltered(term, false, List.of(), pageable)
                .map(employeeMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public TeamSearchResponse searchTeam(String search, String searchBy) {
        String term = search != null && !search.isBlank() ? search.trim() : null;
        String mode = searchBy != null && !searchBy.isBlank() ? searchBy.trim().toUpperCase() : "EMPLOYEE";

        return switch (mode) {
            case "MANAGER" -> searchByManager(term);
            case "VP" -> searchByVp(term);
            default -> searchByEmployee(term);
        };
    }

    private TeamSearchResponse searchByEmployee(String term) {
        List<EmployeeResponse> employees = employeeRepository
                .findFiltered(term, true, List.of("SW_ENGINEER"), Pageable.ofSize(200))
                .getContent()
                .stream()
                .map(employeeMapper::toResponse)
                .toList();
        return TeamSearchResponse.builder()
                .searchBy("EMPLOYEE")
                .employees(employees)
                .build();
    }

    private TeamSearchResponse searchByManager(String term) {
        if (term == null) {
            return emptyTeamSearch("MANAGER");
        }
        List<Employee> managers = employeeRepository.findManagersByNameMatch(term);
        if (managers.isEmpty()) {
            return TeamSearchResponse.builder()
                    .searchBy("MANAGER")
                    .matchedLeaderName(term)
                    .groups(List.of())
                    .build();
        }
        List<TeamManagerGroup> groups = buildManagerGroups(managers);
        String leaderName = managers.size() == 1
                ? managers.get(0).getFullName()
                : managers.stream().map(Employee::getFullName).reduce((a, b) -> a + ", " + b).orElse(term);
        return TeamSearchResponse.builder()
                .searchBy("MANAGER")
                .matchedLeaderName(leaderName)
                .groups(groups)
                .build();
    }

    private TeamSearchResponse searchByVp(String term) {
        if (term == null) {
            return emptyTeamSearch("VP");
        }
        List<Employee> vps = employeeRepository.findVpsByNameMatch(term);
        if (vps.isEmpty()) {
            return TeamSearchResponse.builder()
                    .searchBy("VP")
                    .matchedLeaderName(term)
                    .groups(List.of())
                    .build();
        }
        List<UUID> vpIds = vps.stream().map(Employee::getId).toList();
        List<Employee> managers = employeeRepository.findManagersReportingToVps(vpIds);
        if (managers.isEmpty()) {
            String vpName = vps.size() == 1 ? vps.get(0).getFullName() : term;
            return TeamSearchResponse.builder()
                    .searchBy("VP")
                    .matchedLeaderName(vpName)
                    .groups(List.of())
                    .build();
        }
        List<UUID> managerIds = managers.stream().map(Employee::getId).toList();
        List<Employee> reports = employeeRepository.findEmployeesReportingToManagers(managerIds);
        var reportsByManager = reports.stream()
                .collect(java.util.stream.Collectors.groupingBy(e -> e.getManager().getId()));

        List<TeamManagerGroup> groups = managers.stream()
                .map(manager -> TeamManagerGroup.builder()
                        .managerId(manager.getId())
                        .managerName(manager.getFullName())
                        .manager(employeeMapper.toResponse(manager))
                        .members(reportsByManager.getOrDefault(manager.getId(), List.of()).stream()
                                .map(employeeMapper::toResponse)
                                .toList())
                        .build())
                .toList();

        String vpName = vps.size() == 1 ? vps.get(0).getFullName() : term;
        return TeamSearchResponse.builder()
                .searchBy("VP")
                .matchedLeaderName(vpName)
                .groups(groups)
                .build();
    }

    private List<TeamManagerGroup> buildManagerGroups(List<Employee> managers) {
        List<UUID> managerIds = managers.stream().map(Employee::getId).toList();
        List<Employee> reports = employeeRepository.findEmployeesReportingToManagers(managerIds);
        var reportsByManager = reports.stream()
                .collect(java.util.stream.Collectors.groupingBy(e -> e.getManager().getId()));

        return managers.stream()
                .map(manager -> TeamManagerGroup.builder()
                        .managerId(manager.getId())
                        .managerName(manager.getFullName())
                        .manager(employeeMapper.toResponse(manager))
                        .members(reportsByManager.getOrDefault(manager.getId(), List.of()).stream()
                                .map(employeeMapper::toResponse)
                                .toList())
                        .build())
                .toList();
    }

    private TeamSearchResponse emptyTeamSearch(String searchBy) {
        return TeamSearchResponse.builder()
                .searchBy(searchBy)
                .employees(List.of())
                .groups(List.of())
                .build();
    }

    @Transactional(readOnly = true)
    public EmployeeResponse getEmployee(UUID id) {
        Employee employee = employeeRepository.findDetailedById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
        return employeeMapper.toResponse(employee);
    }

    @Transactional(readOnly = true)
    public List<DepartmentResponse> listDepartments() {
        return departmentRepository.findAll().stream()
                .map(employeeMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DesignationResponse> listDesignations() {
        return designationRepository.findAllWithDepartment().stream()
                .map(d -> DesignationResponse.builder()
                        .id(d.getId())
                        .name(d.getName())
                        .code(d.getCode())
                        .departmentId(d.getDepartment() != null ? d.getDepartment().getId() : null)
                        .departmentName(d.getDepartment() != null ? d.getDepartment().getName() : null)
                        .streamId(d.getStream() != null ? d.getStream().getId() : null)
                        .streamName(d.getStream() != null ? d.getStream().getName() : null)
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RoleOptionResponse> listRoles() {
        return roleRepository.findAll().stream()
                .sorted((a, b) -> {
                    int order = roleSortOrder(a.getCode()) - roleSortOrder(b.getCode());
                    return order != 0 ? order : a.getName().compareToIgnoreCase(b.getName());
                })
                .map(role -> RoleOptionResponse.builder()
                        .id(role.getId())
                        .name(role.getName())
                        .code(role.getCode())
                        .build())
                .toList();
    }

    @Transactional
    public EmployeeResponse createEmployee(CreateEmployeeRequest request) {
        if (employeeRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("EMAIL_EXISTS", "Email already registered", 400);
        }

        validateAssignableRole(request.getRoleCode());
        Role role = roleRepository.findByCodeWithOrgLevel(request.getRoleCode())
                .orElseThrow(() -> new BusinessException("INVALID_ROLE", "Role not found", 400));

        Employee employee = new Employee();
        employee.setId(UUID.randomUUID());
        employee.setEmail(request.getEmail().toLowerCase());
        employee.setFirstName(request.getFirstName());
        employee.setLastName(request.getLastName());
        employee.setStatus("ACTIVE");
        employee.setRoles(Set.of(role));

        if (request.getDepartmentId() != null) {
            Department department = departmentRepository.findById(request.getDepartmentId())
                    .orElseThrow(() -> new BusinessException("INVALID_DEPARTMENT", "Department not found", 400));
            employee.setDepartment(department);
        }
        if (request.getDesignationId() != null) {
            Designation designation = entityManager.getReference(Designation.class, request.getDesignationId());
            employee.setDesignation(designation);
        }
        if (request.getManagerId() != null) {
            Employee manager = employeeRepository.findDetailedById(request.getManagerId())
                    .orElseThrow(() -> new BusinessException("INVALID_MANAGER", "Manager not found", 400));
            orgHierarchyService.validateManagerAssignment(role, manager);
            employee.setManager(manager);
        } else {
            orgHierarchyService.validateManagerAssignment(role, null);
        }

        employeeRepository.save(employee);

        UserAuth auth = new UserAuth();
        auth.setId(UUID.randomUUID());
        auth.setEmployee(employee);
        AuthService.applyNewPassword(auth, request.getPassword(), passwordEncoder);
        auth.setActive(true);
        auth.setFailedAttempts(0);
        userAuthRepository.save(auth);

        return employeeMapper.toResponse(employee);
    }

    @Transactional
    public EmployeeResponse updateEmployee(UUID id, UpdateEmployeeRequest request) {
        Employee employee = employeeRepository.findDetailedById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
        employee.setFirstName(request.getFirstName());
        employee.setLastName(request.getLastName());
        if (request.getStatus() != null) {
            employee.setStatus(request.getStatus());
            userAuthRepository.findByEmployeeId(id).ifPresent(auth -> {
                auth.setActive("ACTIVE".equalsIgnoreCase(request.getStatus()));
                userAuthRepository.save(auth);
            });
        }
        if (request.getRoleCode() != null && !request.getRoleCode().isBlank()) {
            validateAssignableRole(request.getRoleCode());
            Role role = roleRepository.findByCode(request.getRoleCode())
                    .orElseThrow(() -> new BusinessException("INVALID_ROLE", "Role not found", 400));
            employee.getRoles().clear();
            employee.getRoles().add(role);
        }
        if (request.getDepartmentId() != null) {
            Department department = departmentRepository.findById(request.getDepartmentId())
                    .orElseThrow(() -> new BusinessException("INVALID_DEPARTMENT", "Department not found", 400));
            employee.setDepartment(department);
        }
        if (request.getDesignationId() != null) {
            Designation designation = designationRepository.findById(request.getDesignationId())
                    .orElseThrow(() -> new BusinessException("INVALID_DESIGNATION", "Designation not found", 400));
            employee.setDesignation(designation);
        }
        if (request.getManagerId() != null) {
            if (request.getManagerId().equals(id)) {
                throw new BusinessException("VALIDATION", "Employee cannot be their own manager", 400);
            }
            Employee manager = employeeRepository.findDetailedById(request.getManagerId())
                    .orElseThrow(() -> new BusinessException("INVALID_MANAGER", "Manager not found", 400));
            Role primaryRole = employee.getRoles().stream().findFirst()
                    .orElseThrow(() -> new BusinessException("INVALID_ROLE", "Employee has no role", 400));
            orgHierarchyService.validateManagerAssignment(primaryRole, manager);
            employee.setManager(manager);
        }
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            UserAuth auth = userAuthRepository.findByEmployeeId(id)
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Auth record not found", 404));
            AuthService.applyNewPassword(auth, request.getPassword(), passwordEncoder);
            userAuthRepository.save(auth);
        }
        return employeeMapper.toResponse(employeeRepository.save(employee));
    }

    @Transactional
    public void deleteEmployee(UUID id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
        employee.setStatus("INACTIVE");
        employeeRepository.save(employee);
        userAuthRepository.findByEmployeeId(id).ifPresent(auth -> {
            auth.setActive(false);
            userAuthRepository.save(auth);
        });
    }

    @Transactional
    public EmployeeResponse changeRole(UUID id, ChangeRoleRequest request) {
        Employee employee = employeeRepository.findDetailedById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
        validateAssignableRole(request.getRoleCode());
        Role role = roleRepository.findByCode(request.getRoleCode())
                .orElseThrow(() -> new BusinessException("INVALID_ROLE", "Role not found", 400));
        employee.getRoles().clear();
        employee.getRoles().add(role);
        return employeeMapper.toResponse(employeeRepository.save(employee));
    }

    private void validateAssignableRole(String roleCode) {
        if (roleCode == null || roleCode.isBlank()) {
            throw new BusinessException("INVALID_ROLE", "Role is required", 400);
        }
        if (!roleRepository.findByCode(roleCode.trim().toUpperCase()).isPresent()) {
            throw new BusinessException("INVALID_ROLE", "Role not found", 400);
        }
    }

    private static int roleSortOrder(String code) {
        return switch (code) {
            case "SUPER_ADMIN" -> 1;
            case "ADMIN" -> 2;
            case "CXO" -> 3;
            case "VP" -> 4;
            case "MANAGER" -> 5;
            case "EMPLOYEE" -> 6;
            default -> 50;
        };
    }
}
