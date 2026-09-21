package com.nexuspm.issue;

import com.nexuspm.issue.dto.CreateIssueTaskRequest;
import com.nexuspm.issue.dto.IssueTaskResponse;
import com.nexuspm.issue.dto.UpdateIssueTaskRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class IssueTaskController {

    private final IssueTaskService issueTaskService;

    @GetMapping("/issues/{issueId}/tasks")
    @PreAuthorize("@perm.can('ISSUES_VIEW')")
    public List<IssueTaskResponse> list(@PathVariable UUID issueId) {
        return issueTaskService.list(issueId);
    }

    @PostMapping("/issues/{issueId}/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public IssueTaskResponse create(
            @PathVariable UUID issueId,
            @Valid @RequestBody CreateIssueTaskRequest request) {
        return issueTaskService.create(issueId, request);
    }

    @PutMapping("/issue-tasks/{id}")
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public IssueTaskResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateIssueTaskRequest request) {
        return issueTaskService.update(id, request);
    }

    @DeleteMapping("/issue-tasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public void delete(@PathVariable UUID id) {
        issueTaskService.delete(id);
    }
}
