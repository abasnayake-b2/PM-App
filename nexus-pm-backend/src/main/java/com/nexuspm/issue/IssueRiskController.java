package com.nexuspm.issue;

import com.nexuspm.issue.dto.CreateIssueRiskRequest;
import com.nexuspm.issue.dto.IssueRiskResponse;
import com.nexuspm.issue.dto.UpdateIssueRiskRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class IssueRiskController {

    private final IssueRiskService issueRiskService;

    @GetMapping("/issues/{issueId}/risks")
    @PreAuthorize("@perm.can('ISSUES_VIEW')")
    public List<IssueRiskResponse> listRisks(@PathVariable UUID issueId) {
        return issueRiskService.listRisks(issueId);
    }

    @PostMapping("/issues/{issueId}/risks")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public IssueRiskResponse createRisk(
            @PathVariable UUID issueId,
            @Valid @RequestBody CreateIssueRiskRequest request) {
        return issueRiskService.createRisk(issueId, request);
    }

    @PutMapping("/issue-risks/{id}")
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public IssueRiskResponse updateRisk(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateIssueRiskRequest request) {
        return issueRiskService.updateRisk(id, request);
    }

    @DeleteMapping("/issue-risks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('ISSUES_UPDATE')")
    public void deleteRisk(@PathVariable UUID id) {
        issueRiskService.deleteRisk(id);
    }
}
