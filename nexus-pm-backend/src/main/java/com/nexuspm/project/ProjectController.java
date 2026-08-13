package com.nexuspm.project;

import com.nexuspm.issue.IssueImportService;
import com.nexuspm.issue.dto.IssueImportResult;
import com.nexuspm.jira.JiraSyncService;
import com.nexuspm.jira.dto.JiraSyncResult;
import com.nexuspm.project.dto.*;
import com.nexuspm.project.entity.ProjectAccess;
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
@RequestMapping("/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;
    private final ProjectImportService projectImportService;
    private final IssueImportService issueImportService;
    private final JiraSyncService jiraSyncService;

    @GetMapping
    @PreAuthorize("@perm.can('PROJECTS_VIEW')")
    public Page<ProjectResponse> listProjects(
            @RequestParam(required = false) UUID clientId,
            @RequestParam(required = false) UUID regionId,
            @RequestParam(required = false) UUID countryId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String ragStatus,
            @RequestParam(required = false) UUID vpManagementId,
            @RequestParam(required = false) UUID engineeringManagerManagementId,
            @RequestParam(defaultValue = "false") boolean includeArchived,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return projectService.listProjects(
                clientId,
                regionId,
                countryId,
                status,
                ragStatus,
                vpManagementId,
                engineeringManagerManagementId,
                includeArchived,
                pageable);
    }

    @PostMapping("/import")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("@perm.can('IMPORT_CREATE')")
    public ProjectImportResult importProjects(@RequestParam("file") MultipartFile file) {
        return projectImportService.importProjectsExcel(file);
    }

    @PostMapping("/{id}/issues/import")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("@perm.superAdmin()")
    public IssueImportResult importProjectBacklog(@PathVariable UUID id, @RequestParam("file") MultipartFile file) {
        return issueImportService.importBacklogExcel(file, id);
    }

    @PostMapping("/{id}/jira/sync")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("@perm.can('ISSUES_CREATE')")
    public JiraSyncResult syncProjectFromJira(@PathVariable UUID id) {
        return jiraSyncService.syncProject(id);
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.can('PROJECTS_VIEW')")
    public ProjectResponse getProject(@PathVariable UUID id) {
        return projectService.getProject(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('PROJECTS_CREATE')")
    public ProjectResponse createProject(@Valid @RequestBody CreateProjectRequest request) {
        return projectService.createProject(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.can('PROJECTS_UPDATE')")
    public ProjectResponse updateProject(@PathVariable UUID id, @Valid @RequestBody UpdateProjectRequest request) {
        return projectService.updateProject(id, request);
    }

    @PatchMapping("/{id}/rag")
    @PreAuthorize("@perm.can('PROJECTS_UPDATE')")
    public ProjectResponse updateRag(@PathVariable UUID id, @Valid @RequestBody UpdateRagRequest request) {
        return projectService.updateRag(id, request);
    }

    @PatchMapping("/{id}/archive")
    @PreAuthorize("@perm.can('PROJECTS_DELETE')")
    public ProjectResponse archiveProject(@PathVariable UUID id, @RequestParam(defaultValue = "true") boolean archived) {
        return projectService.archiveProject(id, archived);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('PROJECTS_DELETE')")
    public void deleteProject(@PathVariable UUID id) {
        projectService.softDeleteProject(id);
    }

    @PatchMapping("/{id}/restore")
    @PreAuthorize("@perm.superAdmin()")
    public ProjectResponse restoreProject(@PathVariable UUID id) {
        return projectService.restoreProject(id);
    }

    @PostMapping("/{id}/access")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('PROJECTS_UPDATE')")
    public ProjectAccess grantAccess(@PathVariable UUID id, @Valid @RequestBody ProjectAccessRequest request) {
        return projectService.grantProjectAccess(id, request);
    }

    @GetMapping("/{id}/health-log")
    @PreAuthorize("@perm.can('PROJECTS_VIEW')")
    public List<ProjectHealthLogResponse> getHealthLog(@PathVariable UUID id) {
        return projectService.getHealthLog(id);
    }
}
