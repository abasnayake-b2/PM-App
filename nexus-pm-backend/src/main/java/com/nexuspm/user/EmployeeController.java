package com.nexuspm.user;

import com.nexuspm.user.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employeeService;
    private final OrgHierarchyService orgHierarchyService;

    @GetMapping("/org-levels")
    @PreAuthorize("@perm.can('TEAM_VIEW')")
    public List<OrgLevelResponse> listOrgLevels() {
        return orgHierarchyService.listOrgLevels();
    }

    @GetMapping("/roles")
    @PreAuthorize("@perm.can('USERS_VIEW')")
    public List<RoleOptionResponse> listRoles() {
        return employeeService.listRoles();
    }

    @GetMapping
    @PreAuthorize("@perm.can('TEAM_VIEW')")
    public Page<EmployeeResponse> listEmployees(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 100) Pageable pageable) {
        return employeeService.listEmployees(search, pageable);
    }

    @GetMapping("/team-search")
    @PreAuthorize("@perm.can('TEAM_VIEW')")
    public TeamSearchResponse searchTeam(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "EMPLOYEE") String searchBy) {
        return employeeService.searchTeam(search, searchBy);
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.can('TEAM_VIEW')")
    public EmployeeResponse getEmployee(@PathVariable UUID id) {
        return employeeService.getEmployee(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('TEAM_CREATE')")
    public EmployeeResponse createEmployee(@Valid @RequestBody CreateEmployeeRequest request) {
        return employeeService.createEmployee(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.can('TEAM_UPDATE')")
    public EmployeeResponse updateEmployee(@PathVariable UUID id, @Valid @RequestBody UpdateEmployeeRequest request) {
        return employeeService.updateEmployee(id, request);
    }

    @PatchMapping("/{id}/role")
    @PreAuthorize("@perm.can('USERS_UPDATE')")
    public EmployeeResponse changeRole(@PathVariable UUID id, @Valid @RequestBody ChangeRoleRequest request) {
        return employeeService.changeRole(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('TEAM_DELETE')")
    public void deleteEmployee(@PathVariable UUID id) {
        employeeService.deleteEmployee(id);
    }
}
