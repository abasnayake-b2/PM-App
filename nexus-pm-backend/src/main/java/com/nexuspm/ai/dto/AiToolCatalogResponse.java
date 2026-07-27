package com.nexuspm.ai.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Builder
public class AiToolCatalogResponse {
    private UUID id;
    private String toolKey;
    private String displayName;
    private String description;
    private String requiredPermission;
    private int sortOrder;
    private String apiPath;
    private Instant updatedAt;
}
