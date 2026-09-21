package com.nexuspm.project;

import com.nexuspm.project.dto.CreateProjectTaskRequest;
import com.nexuspm.project.dto.ProjectTaskResponse;
import com.nexuspm.project.dto.UpdateProjectTaskRequest;
import com.nexuspm.project.entity.Project;
import com.nexuspm.project.entity.ProjectTask;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.project.repository.ProjectTaskRepository;
import com.nexuspm.issue.IssueDisplayKeys;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProjectTaskService {

    private final ProjectTaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final ProjectService projectService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<ProjectTaskResponse> list(UUID projectId) {
        loadProjectWithAccess(projectId);
        return taskRepository.findActiveByProjectId(projectId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ProjectTaskResponse create(UUID projectId, CreateProjectTaskRequest request) {
        Project project = loadProjectEntity(projectId);
        String description = requireDescription(request.getDescription());

        ProjectTask row = new ProjectTask();
        row.setId(UUID.randomUUID());
        row.setProject(project);
        row.setTaskNumber(taskRepository.findMaxTaskNumber(projectId) + 1);
        row.setDescription(description);
        row.setModule(trimToNull(request.getModule()));

        taskRepository.save(row);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "CREATE",
                "PROJECT_TASK",
                row.getId(),
                displayKey(row) + " on " + project.getName(),
                null);
        return toResponse(row);
    }

    @Transactional
    public ProjectTaskResponse update(UUID id, UpdateProjectTaskRequest request) {
        ProjectTask row = loadWithAccess(id);
        if (request.getDescription() != null) {
            row.setDescription(requireDescription(request.getDescription()));
        }
        if (Boolean.TRUE.equals(request.getClearModule())) {
            row.setModule(null);
        } else if (request.getModule() != null) {
            row.setModule(trimToNull(request.getModule()));
        }
        taskRepository.save(row);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "UPDATE",
                "PROJECT_TASK",
                row.getId(),
                displayKey(row),
                null);
        return toResponse(row);
    }

    @Transactional
    public void delete(UUID id) {
        ProjectTask row = loadWithAccess(id);
        row.setDeleted(true);
        taskRepository.save(row);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "DELETE",
                "PROJECT_TASK",
                row.getId(),
                displayKey(row),
                null);
    }

    private static String requireDescription(String description) {
        if (description == null || description.trim().isEmpty()) {
            throw new BusinessException("VALIDATION", "Task description is required", 400);
        }
        return description.trim();
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void loadProjectWithAccess(UUID projectId) {
        projectService.getProject(projectId);
    }

    private Project loadProjectEntity(UUID projectId) {
        projectService.getProject(projectId);
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Project not found", 404));
    }

    private ProjectTask loadWithAccess(UUID id) {
        ProjectTask row = taskRepository.findActiveDetailedById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Task not found", 404));
        projectService.getProject(row.getProject().getId());
        return row;
    }

    private static String displayKey(ProjectTask row) {
        return IssueDisplayKeys.projectTaskKey(row.getProject(), row.getTaskNumber());
    }

    private ProjectTaskResponse toResponse(ProjectTask row) {
        return ProjectTaskResponse.builder()
                .id(row.getId())
                .projectId(row.getProject().getId())
                .taskNumber(row.getTaskNumber())
                .displayKey(displayKey(row))
                .description(row.getDescription())
                .module(row.getModule())
                .createdAt(row.getCreatedAt())
                .updatedAt(row.getUpdatedAt())
                .build();
    }
}
