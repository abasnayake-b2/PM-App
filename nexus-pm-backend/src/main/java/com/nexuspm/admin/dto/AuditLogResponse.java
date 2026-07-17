package com.nexuspm.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class AuditLogResponse {

    private UUID id;
    private UUID employeeId;
    private String employeeName;
    private String action;
    private String entityType;
    private UUID entityId;
    private String details;
    private String ipAddress;
    private Instant createdAt;
}
