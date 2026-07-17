package com.nexuspm.admin.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.UUID;

@Value
@Builder
public class ReferenceRoleResponse {
    UUID id;
    String name;
    String code;
    Instant createdAt;
    Instant updatedAt;
    UUID createdBy;
    UUID updatedBy;
    String createdByName;
    String updatedByName;
}
