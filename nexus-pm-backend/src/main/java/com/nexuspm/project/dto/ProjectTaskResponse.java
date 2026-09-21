package com.nexuspm.project.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class ProjectTaskResponse {
    private UUID id;
    private UUID projectId;
    private Integer taskNumber;
    /** Display id e.g. ABIC-GBL-PT-1 */
    private String displayKey;
    private String description;
    private String module;
    private Instant createdAt;
    private Instant updatedAt;
}
