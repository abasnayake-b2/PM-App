package com.nexuspm.admin;

import com.nexuspm.admin.dto.*;
import com.nexuspm.issue.field.IssueFieldDefinitionService;
import com.nexuspm.issue.field.dto.CreateIssueFieldDefinitionRequest;
import com.nexuspm.issue.field.dto.IssueFieldDefinitionResponse;
import com.nexuspm.issue.field.dto.UpdateIssueFieldDefinitionRequest;
import com.nexuspm.lookup.entity.IssueStatus;
import com.nexuspm.lookup.entity.IssueType;
import com.nexuspm.lookup.entity.Priority;
import com.nexuspm.user.entity.Department;
import com.nexuspm.user.dto.DesignationResponse;
import com.nexuspm.user.dto.StreamResponse;
import com.nexuspm.user.entity.WorkType;
import com.nexuspm.user.entity.Skill;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;
    private final ReferenceDataService referenceDataService;
    private final ReferenceDataImportService referenceDataImportService;
    private final RoleAccessService roleAccessService;
    private final IssueFieldDefinitionService issueFieldDefinitionService;

    @GetMapping("/audit-logs")
    @PreAuthorize("@perm.can('ADMIN_VIEW')")
    public Page<AuditLogResponse> listAuditLogs(
            @RequestParam(required = false) String search,
            @PageableDefault(size = 25, sort = "createdAt") Pageable pageable) {
        return adminService.listAuditLogs(search, pageable);
    }

    @GetMapping("/holidays")
    @PreAuthorize("@perm.can('ADMIN_VIEW')")
    public List<HolidayResponse> listHolidays() {
        return adminService.listHolidays();
    }

    @PostMapping("/holidays")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('ADMIN_CREATE')")
    public HolidayResponse createHoliday(@Valid @RequestBody CreateHolidayRequest request) {
        return adminService.createHoliday(request);
    }

    @DeleteMapping("/holidays/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('ADMIN_DELETE')")
    public void deleteHoliday(@PathVariable UUID id) {
        adminService.deleteHoliday(id);
    }

    @GetMapping("/workflow-rules")
    @PreAuthorize("@perm.can('ADMIN_VIEW')")
    public List<WorkflowRuleResponse> listWorkflowRules() {
        return adminService.listWorkflowRules();
    }

    @PostMapping("/workflow-rules")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('ADMIN_CREATE')")
    public WorkflowRuleResponse createWorkflowRule(@Valid @RequestBody CreateWorkflowRuleRequest request) {
        return adminService.createWorkflowRule(request);
    }

    @DeleteMapping("/workflow-rules/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('ADMIN_DELETE')")
    public void deleteWorkflowRule(@PathVariable UUID id) {
        adminService.deleteWorkflowRule(id);
    }

    @GetMapping("/settings")
    @PreAuthorize("@perm.can('ADMIN_VIEW')")
    public List<SystemSettingResponse> listSettings() {
        return adminService.listSettings();
    }

    @PutMapping("/settings/{id}")
    @PreAuthorize("@perm.can('ADMIN_UPDATE')")
    public SystemSettingResponse updateSetting(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateSettingRequest request) {
        return adminService.updateSetting(id, request);
    }

    @GetMapping("/notification-templates")
    @PreAuthorize("@perm.can('ADMIN_VIEW')")
    public List<NotificationTemplateResponse> listNotificationTemplates() {
        return adminService.listNotificationTemplates();
    }

    @PostMapping("/reference/import")
    @PreAuthorize("@perm.can('REFERENCE_CREATE')")
    public ReferenceDataImportResult importReferenceData(@RequestParam("file") MultipartFile file) {
        return referenceDataImportService.importExcel(file);
    }

    @PostMapping("/reference/skills/import")
    @PreAuthorize("@perm.can('REFERENCE_CREATE')")
    public ReferenceDataImportResult importSkills(@RequestParam("file") MultipartFile file) {
        return referenceDataImportService.importSkillsExcel(file);
    }

    @GetMapping("/reference/departments")
    @PreAuthorize("@perm.can('REFERENCE_VIEW')")
    public List<Department> listReferenceDepartments() {
        return referenceDataService.listDepartments();
    }

    @PostMapping("/reference/departments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('REFERENCE_CREATE')")
    public Department createDepartment(@Valid @RequestBody ReferenceNameRequest request) {
        return referenceDataService.createDepartment(request.getName());
    }

    @PutMapping("/reference/departments/{id}")
    @PreAuthorize("@perm.can('REFERENCE_UPDATE')")
    public Department updateDepartment(@PathVariable UUID id, @Valid @RequestBody ReferenceNameRequest request) {
        return referenceDataService.updateDepartment(id, request.getName());
    }

    @DeleteMapping("/reference/departments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('REFERENCE_DELETE')")
    public void deleteDepartment(@PathVariable UUID id) {
        referenceDataService.deleteDepartment(id);
    }

    @GetMapping("/reference/streams")
    @PreAuthorize("@perm.can('REFERENCE_VIEW')")
    public List<StreamResponse> listReferenceStreams() {
        return referenceDataService.listStreams();
    }

    @PostMapping("/reference/streams")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('REFERENCE_CREATE')")
    public StreamResponse createStream(@Valid @RequestBody StreamRequest request) {
        return referenceDataService.createStream(request.getName(), request.getDepartmentId());
    }

    @PutMapping("/reference/streams/{id}")
    @PreAuthorize("@perm.can('REFERENCE_UPDATE')")
    public StreamResponse updateStream(@PathVariable UUID id, @Valid @RequestBody StreamRequest request) {
        return referenceDataService.updateStream(id, request.getName(), request.getDepartmentId());
    }

    @DeleteMapping("/reference/streams/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('REFERENCE_DELETE')")
    public void deleteStream(@PathVariable UUID id) {
        referenceDataService.deleteStream(id);
    }

    @GetMapping("/reference/designations")
    @PreAuthorize("@perm.can('REFERENCE_VIEW')")
    public List<DesignationResponse> listReferenceDesignations() {
        return referenceDataService.listDesignations();
    }

    @PostMapping("/reference/designations")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('REFERENCE_CREATE')")
    public DesignationResponse createDesignation(@Valid @RequestBody DesignationRequest request) {
        return referenceDataService.createDesignation(
                request.getName(),
                request.getCode(),
                request.getStreamId(),
                Boolean.TRUE.equals(request.getManagement()));
    }

    @PutMapping("/reference/designations/{id}")
    @PreAuthorize("@perm.can('REFERENCE_UPDATE')")
    public DesignationResponse updateDesignation(@PathVariable UUID id, @Valid @RequestBody DesignationRequest request) {
        return referenceDataService.updateDesignation(
                id,
                request.getName(),
                request.getCode(),
                request.getStreamId(),
                Boolean.TRUE.equals(request.getManagement()));
    }

    @DeleteMapping("/reference/designations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('REFERENCE_DELETE')")
    public void deleteDesignation(@PathVariable UUID id) {
        referenceDataService.deleteDesignation(id);
    }

    @GetMapping("/reference/work-types")
    @PreAuthorize("@perm.can('REFERENCE_VIEW')")
    public List<WorkType> listReferenceWorkTypes() {
        return referenceDataService.listWorkTypes();
    }

    @PostMapping("/reference/work-types")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('REFERENCE_CREATE')")
    public WorkType createWorkType(@Valid @RequestBody ReferenceNameRequest request) {
        return referenceDataService.createWorkType(request.getName());
    }

    @PutMapping("/reference/work-types/{id}")
    @PreAuthorize("@perm.can('REFERENCE_UPDATE')")
    public WorkType updateWorkType(@PathVariable UUID id, @Valid @RequestBody ReferenceNameRequest request) {
        return referenceDataService.updateWorkType(id, request.getName());
    }

    @DeleteMapping("/reference/work-types/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('REFERENCE_DELETE')")
    public void deleteWorkType(@PathVariable UUID id) {
        referenceDataService.deleteWorkType(id);
    }

    @GetMapping("/reference/skills")
    @PreAuthorize("@perm.can('REFERENCE_VIEW')")
    public List<Skill> listReferenceSkills() {
        return referenceDataService.listSkills();
    }

    @PostMapping("/reference/skills")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('REFERENCE_CREATE')")
    public Skill createSkill(@Valid @RequestBody SkillRequest request) {
        return referenceDataService.createSkill(request.getName(), request.getDescription());
    }

    @PutMapping("/reference/skills/{id}")
    @PreAuthorize("@perm.can('REFERENCE_UPDATE')")
    public Skill updateSkill(@PathVariable UUID id, @Valid @RequestBody SkillRequest request) {
        return referenceDataService.updateSkill(id, request.getName(), request.getDescription());
    }

    @DeleteMapping("/reference/skills/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('REFERENCE_DELETE')")
    public void deleteSkill(@PathVariable UUID id) {
        referenceDataService.deleteSkill(id);
    }

    @GetMapping("/reference/roles")
    @PreAuthorize("@perm.can('REFERENCE_VIEW')")
    public List<ReferenceRoleResponse> listReferenceRoles() {
        return referenceDataService.listRoles();
    }

    @PostMapping("/reference/roles")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.superAdmin()")
    public ReferenceRoleResponse createRole(@Valid @RequestBody CreateRoleRequest request) {
        return referenceDataService.createRole(request.getName(), request.getCode());
    }

    @PutMapping("/reference/roles/{id}")
    @PreAuthorize("@perm.superAdmin()")
    public ReferenceRoleResponse updateRole(@PathVariable UUID id, @Valid @RequestBody ReferenceNameRequest request) {
        return referenceDataService.updateRole(id, request.getName());
    }

    @DeleteMapping("/reference/roles/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.superAdmin()")
    public void deleteRole(@PathVariable UUID id) {
        referenceDataService.deleteRole(id);
    }

    @GetMapping("/access/permissions")
    @PreAuthorize("@perm.superAdmin()")
    public List<PermissionResponse> listPermissions() {
        return roleAccessService.listPermissions();
    }

    @GetMapping("/access/roles")
    @PreAuthorize("@perm.superAdmin()")
    public List<RoleAccessResponse> listAccessRoles() {
        return roleAccessService.listRoles();
    }

    @PostMapping("/access/roles")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.superAdmin()")
    public RoleAccessResponse createAccessRole(@Valid @RequestBody CreateAccessRoleRequest request) {
        return roleAccessService.createRole(request);
    }

    @GetMapping("/access/roles/{id}")
    @PreAuthorize("@perm.superAdmin()")
    public RoleAccessResponse getRoleAccess(@PathVariable UUID id) {
        return roleAccessService.getRoleAccess(id);
    }

    @PutMapping("/access/roles/{id}/permissions")
    @PreAuthorize("@perm.superAdmin()")
    public RoleAccessResponse updateRolePermissions(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRolePermissionsRequest request) {
        return roleAccessService.updateRolePermissions(id, request.getPermissionCodes());
    }

    @DeleteMapping("/access/roles/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.superAdmin()")
    public void deleteAccessRole(@PathVariable UUID id) {
        roleAccessService.deleteRole(id);
    }

    @GetMapping("/reference/issue-types")
    @PreAuthorize("@perm.can('REFERENCE_VIEW')")
    public List<IssueType> listReferenceIssueTypes() {
        return referenceDataService.listIssueTypes();
    }

    @PostMapping("/reference/issue-types")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('REFERENCE_CREATE')")
    public IssueType createIssueType(@Valid @RequestBody IssueTypeRequest request) {
        return referenceDataService.createIssueType(request.getName(), request.getWorkflowCode(), request.getDescription());
    }

    @PutMapping("/reference/issue-types/{id}")
    @PreAuthorize("@perm.can('REFERENCE_UPDATE')")
    public IssueType updateIssueType(@PathVariable UUID id, @Valid @RequestBody IssueTypeRequest request) {
        return referenceDataService.updateIssueType(id, request.getName(), request.getWorkflowCode(), request.getDescription());
    }

    @DeleteMapping("/reference/issue-types/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('REFERENCE_DELETE')")
    public void deleteIssueType(@PathVariable UUID id) {
        referenceDataService.deleteIssueType(id);
    }

    @GetMapping("/reference/statuses")
    @PreAuthorize("@perm.can('REFERENCE_VIEW')")
    public List<IssueStatus> listReferenceStatuses() {
        return referenceDataService.listIssueStatuses();
    }

    @PostMapping("/reference/statuses")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('REFERENCE_CREATE')")
    public IssueStatus createIssueStatus(@Valid @RequestBody IssueStatusRequest request) {
        return referenceDataService.createIssueStatus(
                request.getName(), request.getSequence(), request.isTerminal(), request.getColour());
    }

    @PutMapping("/reference/statuses/{id}")
    @PreAuthorize("@perm.can('REFERENCE_UPDATE')")
    public IssueStatus updateIssueStatus(@PathVariable UUID id, @Valid @RequestBody IssueStatusRequest request) {
        return referenceDataService.updateIssueStatus(
                id, request.getName(), request.getSequence(), request.isTerminal(), request.getColour());
    }

    @DeleteMapping("/reference/statuses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('REFERENCE_DELETE')")
    public void deleteIssueStatus(@PathVariable UUID id) {
        referenceDataService.deleteIssueStatus(id);
    }

    @GetMapping("/reference/priorities")
    @PreAuthorize("@perm.can('REFERENCE_VIEW')")
    public List<Priority> listReferencePriorities() {
        return referenceDataService.listPriorities();
    }

    @PostMapping("/reference/priorities")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('REFERENCE_CREATE')")
    public Priority createPriority(@Valid @RequestBody PriorityRequest request) {
        return referenceDataService.createPriority(
                request.getLabel(), request.getLevel(), request.getSlaResponseHrs(),
                request.getSlaResolveHrs(), request.getColour());
    }

    @PutMapping("/reference/priorities/{id}")
    @PreAuthorize("@perm.can('REFERENCE_UPDATE')")
    public Priority updatePriority(@PathVariable UUID id, @Valid @RequestBody PriorityRequest request) {
        return referenceDataService.updatePriority(
                id, request.getLabel(), request.getLevel(), request.getSlaResponseHrs(),
                request.getSlaResolveHrs(), request.getColour());
    }

    @DeleteMapping("/reference/priorities/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('REFERENCE_DELETE')")
    public void deletePriority(@PathVariable UUID id) {
        referenceDataService.deletePriority(id);
    }

    @GetMapping("/reference/issue-fields")
    @PreAuthorize("@perm.can('REFERENCE_VIEW')")
    public List<IssueFieldDefinitionResponse> listReferenceIssueFields() {
        return issueFieldDefinitionService.listAll();
    }

    @PostMapping("/reference/issue-fields")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('REFERENCE_CREATE')")
    public IssueFieldDefinitionResponse createIssueField(
            @Valid @RequestBody CreateIssueFieldDefinitionRequest request) {
        return issueFieldDefinitionService.create(request);
    }

    @PutMapping("/reference/issue-fields/{id}")
    @PreAuthorize("@perm.can('REFERENCE_UPDATE')")
    public IssueFieldDefinitionResponse updateIssueField(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateIssueFieldDefinitionRequest request) {
        return issueFieldDefinitionService.update(id, request);
    }

    @DeleteMapping("/reference/issue-fields/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('REFERENCE_DELETE')")
    public void deleteIssueField(@PathVariable UUID id) {
        issueFieldDefinitionService.delete(id);
    }
}
