package com.nexuspm.project;

import com.nexuspm.project.dto.CreateProjectTaskRequest;
import com.nexuspm.project.dto.ProjectTaskResponse;
import com.nexuspm.project.dto.UpdateProjectTaskRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ProjectTaskController {

    private final ProjectTaskService projectTaskService;

    @GetMapping("/projects/{projectId}/tasks")
    @PreAuthorize("@perm.can('PROJECTS_VIEW')")
    public List<ProjectTaskResponse> list(@PathVariable UUID projectId) {
        return projectTaskService.list(projectId);
    }

    @PostMapping("/projects/{projectId}/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('PROJECTS_UPDATE')")
    public ProjectTaskResponse create(
            @PathVariable UUID projectId,
            @Valid @RequestBody CreateProjectTaskRequest request) {
        return projectTaskService.create(projectId, request);
    }

    @PutMapping("/project-tasks/{id}")
    @PreAuthorize("@perm.can('PROJECTS_UPDATE')")
    public ProjectTaskResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateProjectTaskRequest request) {
        return projectTaskService.update(id, request);
    }

    @DeleteMapping("/project-tasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('PROJECTS_UPDATE')")
    public void delete(@PathVariable UUID id) {
        projectTaskService.delete(id);
    }
}
