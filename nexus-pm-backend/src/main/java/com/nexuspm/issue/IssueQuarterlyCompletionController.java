package com.nexuspm.issue;

import com.nexuspm.issue.dto.CreateIssueQuarterlyCompletionRequest;
import com.nexuspm.issue.dto.IssueQuarterlyCompletionResponse;
import com.nexuspm.issue.dto.UpdateIssueQuarterlyCompletionRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class IssueQuarterlyCompletionController {

    private final IssueQuarterlyCompletionService quarterlyCompletionService;

    @GetMapping("/issues/{issueId}/quarterly-completions")
    @PreAuthorize("@perm.can('ISSUES_VIEW')")
    public List<IssueQuarterlyCompletionResponse> list(@PathVariable UUID issueId) {
        return quarterlyCompletionService.list(issueId);
    }

    @PostMapping("/issues/{issueId}/quarterly-completions")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public IssueQuarterlyCompletionResponse create(
            @PathVariable UUID issueId,
            @Valid @RequestBody CreateIssueQuarterlyCompletionRequest request) {
        return quarterlyCompletionService.create(issueId, request);
    }

    @PutMapping("/quarterly-completions/{id}")
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public IssueQuarterlyCompletionResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateIssueQuarterlyCompletionRequest request) {
        return quarterlyCompletionService.update(id, request);
    }

    @DeleteMapping("/quarterly-completions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public void delete(@PathVariable UUID id) {
        quarterlyCompletionService.delete(id);
    }
}
