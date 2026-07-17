package com.nexuspm.user.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class DesignationResponse {

    private UUID id;
    private String name;
    private String code;
    private UUID departmentId;
    private String departmentName;
    private UUID streamId;
    private String streamName;
    private Instant createdAt;
    private Instant updatedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private String createdByName;
    private String updatedByName;
}
