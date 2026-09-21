package com.nexuspm.issue;

import com.nexuspm.issue.dto.CreateIssueTaskRequest;
import com.nexuspm.issue.dto.IssueTaskResponse;
import com.nexuspm.issue.dto.UpdateIssueTaskRequest;
import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.entity.RdIssueTask;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.issue.repository.RdIssueTaskRepository;
import com.nexuspm.project.ProjectService;
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
public class IssueTaskService {

    private final RdIssueTaskRepository taskRepository;
    private final RdIssueRepository issueRepository;
    private final ProjectService projectService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<IssueTaskResponse> list(UUID issueId) {
        loadIssueWithAccess(issueId);
        return taskRepository.findActiveByIssueId(issueId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public IssueTaskResponse create(UUID issueId, CreateIssueTaskRequest request) {
        RdIssue issue = loadIssueWithAccess(issueId);
        String description = requireDescription(request.getDescription());

        RdIssueTask row = new RdIssueTask();
        row.setId(UUID.randomUUID());
        row.setIssue(issue);
        row.setTaskNumber(taskRepository.findMaxTaskNumber(issueId) + 1);
        row.setDescription(description);
        row.setModule(trimToNull(request.getModule()));

        taskRepository.save(row);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "CREATE",
                "ISSUE_TASK",
                row.getId(),
                displayKey(row) + " on " + issue.getDisplayKey(),
                null);
        return toResponse(row);
    }

    @Transactional
    public IssueTaskResponse update(UUID id, UpdateIssueTaskRequest request) {
        RdIssueTask row = loadWithAccess(id);
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
                "ISSUE_TASK",
                row.getId(),
                displayKey(row) + " on " + row.getIssue().getDisplayKey(),
                null);
        return toResponse(row);
    }

    @Transactional
    public void delete(UUID id) {
        RdIssueTask row = loadWithAccess(id);
        row.setDeleted(true);
        taskRepository.save(row);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "DELETE",
                "ISSUE_TASK",
                row.getId(),
                displayKey(row) + " on " + row.getIssue().getDisplayKey(),
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

    private RdIssue loadIssueWithAccess(UUID issueId) {
        RdIssue issue = issueRepository.findDetailedById(issueId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue not found", 404));
        projectService.getProject(issue.getProject().getId());
        return issue;
    }

    private RdIssueTask loadWithAccess(UUID id) {
        RdIssueTask row = taskRepository.findActiveDetailedById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Task not found", 404));
        projectService.getProject(row.getIssue().getProject().getId());
        return row;
    }

    private static String displayKey(RdIssueTask row) {
        String rdKey = row.getIssue() != null ? row.getIssue().getDisplayKey() : null;
        return IssueDisplayKeys.rdTaskKey(rdKey, row.getTaskNumber());
    }

    private IssueTaskResponse toResponse(RdIssueTask row) {
        return IssueTaskResponse.builder()
                .id(row.getId())
                .issueId(row.getIssue().getId())
                .taskNumber(row.getTaskNumber())
                .displayKey(displayKey(row))
                .description(row.getDescription())
                .module(row.getModule())
                .createdAt(row.getCreatedAt())
                .updatedAt(row.getUpdatedAt())
                .build();
    }
}
