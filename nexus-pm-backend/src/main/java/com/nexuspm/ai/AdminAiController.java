package com.nexuspm.ai;

import com.nexuspm.ai.dto.AddAiToolRequest;
import com.nexuspm.ai.dto.AiSettingsResponse;
import com.nexuspm.ai.dto.AiToolCatalogResponse;
import com.nexuspm.ai.dto.UpdateAiSettingsRequest;
import com.nexuspm.ai.dto.UpdateAiToolRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminAiController {

    private final AiToolCatalogService catalogService;
    private final AiSettingsService settingsService;

    @GetMapping("/ai-tools/available")
    @PreAuthorize("@perm.can('ADMIN_VIEW')")
    public List<AiToolCatalogResponse> availableTools() {
        return catalogService.listAvailable();
    }

    @GetMapping("/ai-tools/active")
    @PreAuthorize("@perm.can('ADMIN_VIEW')")
    public List<AiToolCatalogResponse> activeTools() {
        return catalogService.listActive();
    }

    @PostMapping("/ai-tools/active")
    @PreAuthorize("@perm.can('ADMIN_CREATE')")
    public AiToolCatalogResponse addTool(@Valid @RequestBody AddAiToolRequest request) {
        return catalogService.add(request);
    }

    @PutMapping("/ai-tools/active/{id}")
    @PreAuthorize("@perm.can('ADMIN_UPDATE')")
    public AiToolCatalogResponse updateTool(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAiToolRequest request) {
        return catalogService.update(id, request);
    }

    @DeleteMapping("/ai-tools/active/{id}")
    @PreAuthorize("@perm.can('ADMIN_DELETE')")
    public void removeTool(@PathVariable UUID id) {
        catalogService.remove(id);
    }

    @GetMapping("/ai-settings")
    @PreAuthorize("@perm.can('ADMIN_VIEW')")
    public AiSettingsResponse getAiSettings() {
        return settingsService.getSettings();
    }

    @GetMapping("/ai-settings/profiles")
    @PreAuthorize("@perm.can('ADMIN_VIEW')")
    public Map<String, Object> profiles() {
        return Map.of("profiles", settingsService.listProfiles());
    }

    @PutMapping("/ai-settings")
    @PreAuthorize("@perm.can('ADMIN_UPDATE')")
    public AiSettingsResponse updateAiSettings(@Valid @RequestBody UpdateAiSettingsRequest request) {
        return settingsService.updateSettings(request);
    }
}
