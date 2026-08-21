package com.nexuspm.issue;

import com.nexuspm.issue.dto.CreateIssueQuarterlyCompletionRequest;
import com.nexuspm.issue.dto.IssueQuarterlyCompletionResponse;
import com.nexuspm.issue.dto.UpdateIssueQuarterlyCompletionRequest;
import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.entity.RdIssueQuarterlyCompletion;
import com.nexuspm.issue.repository.RdIssueQuarterlyCompletionRepository;
import com.nexuspm.issue.repository.RdIssueRepository;
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
public class IssueQuarterlyCompletionService {

    private final RdIssueQuarterlyCompletionRepository completionRepository;
    private final RdIssueRepository issueRepository;
    private final ProjectService projectService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<IssueQuarterlyCompletionResponse> list(UUID issueId) {
        loadIssueWithAccess(issueId);
        return completionRepository.findActiveByIssueId(issueId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public IssueQuarterlyCompletionResponse create(UUID issueId, CreateIssueQuarterlyCompletionRequest request) {
        RdIssue issue = loadIssueWithAccess(issueId);
        ensureQuarterFree(issueId, request.getYear(), request.getQuarter(), null);

        RdIssueQuarterlyCompletion row = new RdIssueQuarterlyCompletion();
        row.setId(UUID.randomUUID());
        row.setIssue(issue);
        row.setYear(request.getYear());
        row.setQuarter(request.getQuarter());
        row.setPercentage(request.getPercentage());

        completionRepository.save(row);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "CREATE",
                "ISSUE_QUARTERLY_COMPLETION",
                row.getId(),
                row.getDisplayKey() + " on " + issue.getDisplayKey(),
                null);
        return toResponse(row);
    }

    @Transactional
    public IssueQuarterlyCompletionResponse update(UUID id, UpdateIssueQuarterlyCompletionRequest request) {
        RdIssueQuarterlyCompletion row = loadWithAccess(id);

        if (request.getYear() != null) {
            row.setYear(request.getYear());
        }
        if (request.getQuarter() != null) {
            row.setQuarter(request.getQuarter());
        }
        if (request.getPercentage() != null) {
            row.setPercentage(request.getPercentage());
        }

        ensureQuarterFree(row.getIssue().getId(), row.getYear(), row.getQuarter(), row.getId());
        completionRepository.save(row);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "UPDATE",
                "ISSUE_QUARTERLY_COMPLETION",
                row.getId(),
                row.getDisplayKey(),
                null);
        return toResponse(row);
    }

    @Transactional
    public void delete(UUID id) {
        RdIssueQuarterlyCompletion row = loadWithAccess(id);
        row.setDeleted(true);
        completionRepository.save(row);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "DELETE",
                "ISSUE_QUARTERLY_COMPLETION",
                row.getId(),
                row.getDisplayKey(),
                null);
    }

    private void ensureQuarterFree(UUID issueId, Integer year, Integer quarter, UUID excludeId) {
        boolean taken = excludeId == null
                ? completionRepository.existsByIssue_IdAndYearAndQuarterAndDeletedFalse(issueId, year, quarter)
                : completionRepository.existsByIssue_IdAndYearAndQuarterAndDeletedFalseAndIdNot(
                        issueId, year, quarter, excludeId);
        if (taken) {
            throw new BusinessException(
                    "VALIDATION",
                    year + " Q" + quarter + " already exists for this RD",
                    400);
        }
    }

    private RdIssue loadIssueWithAccess(UUID issueId) {
        RdIssue issue = issueRepository.findDetailedById(issueId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue not found", 404));
        projectService.getProject(issue.getProject().getId());
        return issue;
    }

    private RdIssueQuarterlyCompletion loadWithAccess(UUID id) {
        RdIssueQuarterlyCompletion row = completionRepository.findActiveDetailedById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Quarterly completion not found", 404));
        projectService.getProject(row.getIssue().getProject().getId());
        return row;
    }

    private IssueQuarterlyCompletionResponse toResponse(RdIssueQuarterlyCompletion row) {
        return IssueQuarterlyCompletionResponse.builder()
                .id(row.getId())
                .issueId(row.getIssue().getId())
                .year(row.getYear())
                .quarter(row.getQuarter())
                .displayKey(row.getDisplayKey())
                .percentage(row.getPercentage())
                .createdAt(row.getCreatedAt())
                .updatedAt(row.getUpdatedAt())
                .build();
    }
}
