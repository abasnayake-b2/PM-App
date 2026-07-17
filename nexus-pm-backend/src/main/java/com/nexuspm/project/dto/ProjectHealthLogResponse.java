package com.nexuspm.project.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class ProjectHealthLogResponse {

    private UUID id;
    private String ragStatus;
    private String notes;
    private UUID changedById;
    private String changedByName;
    private Instant createdAt;
}
