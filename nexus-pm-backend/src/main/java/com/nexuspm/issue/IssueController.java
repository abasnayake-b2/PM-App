package com.nexuspm.issue;

import com.nexuspm.issue.dto.*;
import com.nexuspm.jira.JiraWorklogService;
import com.nexuspm.jira.dto.JiraWorklogResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/issues")
@RequiredArgsConstructor
public class IssueController {

    private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private final IssueService issueService;
    private final IssueImportService issueImportService;
    private final JiraWorklogService jiraWorklogService;

    @PostMapping("/import")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("@perm.superAdmin()")
    public IssueImportResult importBacklog(@RequestParam("file") MultipartFile file) {
        return issueImportService.importBacklogExcel(file, null);
    }

    @GetMapping
    @PreAuthorize("@perm.can('ISSUES_VIEW')")
    public Page<IssueResponse> listIssues(
            @RequestParam(required = false) UUID releaseId,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) Boolean unreleasedOnly,
            @RequestParam(required = false) UUID statusId,
            @RequestParam(required = false) List<UUID> statusIds,
            @RequestParam(required = false) String slaStatus,
            @RequestParam(required = false) UUID assignedToId,
            @RequestParam(required = false) UUID priorityId,
            @RequestParam(required = false) UUID issueTypeId,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 50, sort = {"project.name", "rdNumber", "childNumber", "createdAt"}) Pageable pageable) {
        return issueService.listIssues(
                releaseId, projectId, unreleasedOnly, statusId, statusIds, slaStatus,
                assignedToId, priorityId, issueTypeId, q, pageable);
    }

    @GetMapping("/export")
    @PreAuthorize("@perm.can('ISSUES_VIEW')")
    public ResponseEntity<byte[]> exportBacklog(
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) UUID statusId,
            @RequestParam(required = false) List<UUID> statusIds,
            @RequestParam(required = false) UUID priorityId,
            @RequestParam(required = false) UUID issueTypeId,
            @RequestParam(required = false) String q) throws IOException {
        byte[] body = issueService.exportBacklogExcel(
                projectId, statusId, statusIds, priorityId, issueTypeId, q);
        String filename = "backlog-rds-by-project-" + FILE_DATE.format(LocalDate.now()) + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(body);
    }

    @GetMapping("/status-counts")
    @PreAuthorize("@perm.can('ISSUES_VIEW')")
    public IssueStatusCountsResponse statusCounts(
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) Boolean unreleasedOnly,
            @RequestParam(required = false) UUID priorityId,
            @RequestParam(required = false) UUID issueTypeId) {
        return issueService.getStatusCounts(projectId, unreleasedOnly, priorityId, issueTypeId);
    }

    @GetMapping("/cr-status-matrix")
    @PreAuthorize("@perm.can('ISSUES_VIEW')")
    public CrStatusMatrixResponse crStatusMatrix(@RequestParam(required = false) UUID projectId) {
        return issueService.getCrStatusMatrix(projectId);
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.can('ISSUES_VIEW')")
    public IssueResponse getIssue(@PathVariable UUID id) {
        return issueService.getIssue(id);
    }

    @GetMapping("/{id}/children")
    @PreAuthorize("@perm.can('ISSUES_VIEW')")
    public java.util.List<IssueResponse> listChildIssues(@PathVariable UUID id) {
        return issueService.listChildIssues(id);
    }

    @GetMapping("/{id}/allowed-child-types")
    @PreAuthorize("@perm.can('ISSUES_VIEW')")
    public java.util.List<String> allowedChildTypes(@PathVariable UUID id) {
        return issueService.allowedChildWorkflowCodes(id);
    }

    @GetMapping("/{id}/jira/worklogs")
    @PreAuthorize("@perm.can('ISSUES_VIEW')")
    public JiraWorklogResponse getJiraWorklogs(@PathVariable UUID id) {
        return jiraWorklogService.getWorklogsForIssue(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('ISSUES_CREATE')")
    public IssueResponse createIssue(@Valid @RequestBody CreateIssueRequest request) {
        return issueService.createIssue(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public IssueResponse updateIssue(@PathVariable UUID id, @Valid @RequestBody UpdateIssueRequest request) {
        return issueService.updateIssue(id, request);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public IssueResponse transitionIssue(@PathVariable UUID id, @Valid @RequestBody TransitionIssueRequest request) {
        return issueService.transitionIssue(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('ISSUES_DELETE')")
    public void deleteIssue(@PathVariable UUID id) {
        issueService.softDeleteIssue(id);
    }

    @PatchMapping("/{id}/restore")
    @PreAuthorize("@perm.superAdmin()")
    public IssueResponse restoreIssue(@PathVariable UUID id) {
        return issueService.restoreIssue(id);
    }
}
