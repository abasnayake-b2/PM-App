package com.nexuspm.project;

import com.nexuspm.risk.dto.CreateRiskRequest;
import com.nexuspm.risk.dto.RiskResponse;
import com.nexuspm.risk.dto.UpdateRiskRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ProjectRiskController {

    private final ProjectRiskService projectRiskService;

    @GetMapping("/projects/{projectId}/risks")
    @PreAuthorize("@perm.can('PROJECTS_VIEW')")
    public List<RiskResponse> listRisks(@PathVariable UUID projectId) {
        return projectRiskService.listRisks(projectId);
    }

    @PostMapping("/projects/{projectId}/risks")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('PROJECTS_UPDATE')")
    public RiskResponse createRisk(
            @PathVariable UUID projectId,
            @Valid @RequestBody CreateRiskRequest request) {
        return projectRiskService.createRisk(projectId, request);
    }

    @PutMapping("/project-risks/{id}")
    @PreAuthorize("@perm.can('PROJECTS_UPDATE')")
    public RiskResponse updateRisk(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRiskRequest request) {
        return projectRiskService.updateRisk(id, request);
    }

    @DeleteMapping("/project-risks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('PROJECTS_UPDATE')")
    public void deleteRisk(@PathVariable UUID id) {
        projectRiskService.deleteRisk(id);
    }
}
