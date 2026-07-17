package com.nexuspm.release;

import com.nexuspm.release.dto.CreateReleaseRequest;
import com.nexuspm.release.dto.ReleaseResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/releases")
@RequiredArgsConstructor
public class ReleaseController {

    private final ReleaseService releaseService;

    @GetMapping
    @PreAuthorize("@perm.can('RELEASES_VIEW')")
    public List<ReleaseResponse> listReleases(@RequestParam(required = false) UUID projectId) {
        return releaseService.listReleases(projectId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('RELEASES_CREATE')")
    public ReleaseResponse createRelease(@Valid @RequestBody CreateReleaseRequest request) {
        return releaseService.createRelease(request);
    }
}
