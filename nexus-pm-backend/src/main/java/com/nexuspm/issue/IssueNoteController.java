package com.nexuspm.issue;

import com.nexuspm.issue.dto.CreateIssueNoteRequest;
import com.nexuspm.issue.dto.IssueNoteResponse;
import com.nexuspm.issue.dto.UpdateIssueNoteRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class IssueNoteController {

    private final IssueNoteService issueNoteService;

    @GetMapping("/issues/{issueId}/notes")
    @PreAuthorize("@perm.can('ISSUES_VIEW')")
    public List<IssueNoteResponse> list(@PathVariable UUID issueId) {
        return issueNoteService.list(issueId);
    }

    @PostMapping("/issues/{issueId}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public IssueNoteResponse create(
            @PathVariable UUID issueId,
            @Valid @RequestBody CreateIssueNoteRequest request) {
        return issueNoteService.create(issueId, request);
    }

    @PutMapping("/issue-notes/{id}")
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public IssueNoteResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateIssueNoteRequest request) {
        return issueNoteService.update(id, request);
    }

    @DeleteMapping("/issue-notes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public void delete(@PathVariable UUID id) {
        issueNoteService.delete(id);
    }
}
