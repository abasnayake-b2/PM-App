package com.nexuspm.ai;

import com.nexuspm.ai.dto.AddAiToolRequest;
import com.nexuspm.ai.dto.AiToolCatalogResponse;
import com.nexuspm.ai.dto.UpdateAiToolRequest;
import com.nexuspm.ai.entity.AiToolCatalogEntry;
import com.nexuspm.ai.repository.AiToolCatalogRepository;
import com.nexuspm.ai.tools.EligibleToolRegistry;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.cache.CacheNames;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AiToolCatalogService {

    private final AiToolCatalogRepository repository;
    private final EligibleToolRegistry eligibleToolRegistry;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    @Cacheable(cacheNames = CacheNames.AI_TOOL_CATALOG, key = "'active'")
    public List<AiToolCatalogEntry> listActiveEntities() {
        return repository.findAllByOrderBySortOrderAscDisplayNameAsc();
    }

    @Transactional(readOnly = true)
    public List<AiToolCatalogResponse> listActive() {
        return listActiveEntities().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<AiToolCatalogResponse> listAvailable() {
        Set<String> active = listActiveEntities().stream()
                .map(AiToolCatalogEntry::getToolKey)
                .collect(Collectors.toSet());
        return eligibleToolRegistry.availableMinus(active).stream()
                .map(t -> AiToolCatalogResponse.builder()
                        .toolKey(t.toolKey())
                        .displayName(t.displayName())
                        .description(t.defaultDescription())
                        .requiredPermission(t.defaultPermission())
                        .apiPath(t.apiPath())
                        .sortOrder(0)
                        .build())
                .toList();
    }

    @Transactional
    @CacheEvict(cacheNames = CacheNames.AI_TOOL_CATALOG, allEntries = true)
    public AiToolCatalogResponse add(AddAiToolRequest request) {
        String toolKey = request.getToolKey().trim();
        EligibleToolRegistry.EligibleTool eligible = eligibleToolRegistry.find(toolKey)
                .orElseThrow(() -> new BusinessException("AI_UNKNOWN_TOOL", "Tool is not in the eligible pool: " + toolKey, 400));
        if (repository.existsByToolKey(toolKey)) {
            throw new BusinessException("AI_TOOL_EXISTS", "Tool is already active: " + toolKey, 409);
        }

        AiToolCatalogEntry entry = new AiToolCatalogEntry();
        entry.setId(UUID.randomUUID());
        entry.setToolKey(toolKey);
        entry.setDisplayName(blankTo(request.getDisplayName(), eligible.displayName()));
        entry.setDescription(blankTo(request.getDescription(), eligible.defaultDescription()));
        entry.setRequiredPermission(eligible.defaultPermission());
        entry.setSortOrder(nextSortOrder());
        entry.setUpdatedBy(SecurityUtils.currentUserId());
        repository.save(entry);

        auditLogService.log(SecurityUtils.currentUserId(), "CREATE", "AI_TOOL", entry.getId(), toolKey, null);
        return toResponse(entry);
    }

    @Transactional
    @CacheEvict(cacheNames = CacheNames.AI_TOOL_CATALOG, allEntries = true)
    public AiToolCatalogResponse update(UUID id, UpdateAiToolRequest request) {
        AiToolCatalogEntry entry = repository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Active AI tool not found", 404));
        if (request.getDisplayName() != null && !request.getDisplayName().isBlank()) {
            entry.setDisplayName(request.getDisplayName().trim());
        }
        if (request.getDescription() != null) {
            entry.setDescription(request.getDescription());
        }
        if (request.getRequiredPermission() != null) {
            entry.setRequiredPermission(request.getRequiredPermission().isBlank()
                    ? null
                    : request.getRequiredPermission().trim());
        }
        if (request.getSortOrder() != null) {
            entry.setSortOrder(request.getSortOrder());
        }
        entry.setUpdatedBy(SecurityUtils.currentUserId());
        repository.save(entry);
        auditLogService.log(SecurityUtils.currentUserId(), "UPDATE", "AI_TOOL", entry.getId(), entry.getToolKey(), null);
        return toResponse(entry);
    }

    @Transactional
    @CacheEvict(cacheNames = CacheNames.AI_TOOL_CATALOG, allEntries = true)
    public void remove(UUID id) {
        AiToolCatalogEntry entry = repository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Active AI tool not found", 404));
        String key = entry.getToolKey();
        repository.delete(entry);
        auditLogService.log(SecurityUtils.currentUserId(), "DELETE", "AI_TOOL", id, key, null);
    }

    private int nextSortOrder() {
        return listActiveEntities().stream()
                .mapToInt(AiToolCatalogEntry::getSortOrder)
                .max()
                .orElse(0) + 10;
    }

    private AiToolCatalogResponse toResponse(AiToolCatalogEntry entry) {
        String apiPath = eligibleToolRegistry.find(entry.getToolKey())
                .map(EligibleToolRegistry.EligibleTool::apiPath)
                .orElse(null);
        return AiToolCatalogResponse.builder()
                .id(entry.getId())
                .toolKey(entry.getToolKey())
                .displayName(entry.getDisplayName())
                .description(entry.getDescription())
                .requiredPermission(entry.getRequiredPermission())
                .sortOrder(entry.getSortOrder())
                .apiPath(apiPath)
                .updatedAt(entry.getUpdatedAt())
                .build();
    }

    private static String blankTo(String value, String fallback) {
        return value != null && !value.isBlank() ? value.trim() : fallback;
    }
}
