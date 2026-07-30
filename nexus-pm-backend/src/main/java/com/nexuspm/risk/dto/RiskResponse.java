package com.nexuspm.risk.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class RiskResponse {
    private UUID id;
    private UUID parentId;
    private Integer riskNumber;
    private String displayKey;
    private String description;
    private LocalDate createdDate;
    private String owner;
    private String status;
    private String impact;
    private LocalDate closedDate;
    private String mitigation;
    private Instant createdAt;
    private Instant updatedAt;
}
