package com.nexuspm.release;

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
public class ReleaseRiskController {

    private final ReleaseRiskService releaseRiskService;

    @GetMapping("/releases/{releaseId}/risks")
    @PreAuthorize("@perm.can('RELEASES_VIEW') or @perm.can('PROJECTS_VIEW')")
    public List<RiskResponse> listRisks(@PathVariable UUID releaseId) {
        return releaseRiskService.listRisks(releaseId);
    }

    @PostMapping("/releases/{releaseId}/risks")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('PROJECTS_UPDATE') or @perm.can('RELEASES_CREATE')")
    public RiskResponse createRisk(
            @PathVariable UUID releaseId,
            @Valid @RequestBody CreateRiskRequest request) {
        return releaseRiskService.createRisk(releaseId, request);
    }

    @PutMapping("/release-risks/{id}")
    @PreAuthorize("@perm.can('PROJECTS_UPDATE') or @perm.can('RELEASES_CREATE')")
    public RiskResponse updateRisk(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRiskRequest request) {
        return releaseRiskService.updateRisk(id, request);
    }

    @DeleteMapping("/release-risks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('PROJECTS_UPDATE') or @perm.can('RELEASES_CREATE')")
    public void deleteRisk(@PathVariable UUID id) {
        releaseRiskService.deleteRisk(id);
    }
}
