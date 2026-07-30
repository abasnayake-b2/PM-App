package com.nexuspm.issue.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class IssueRiskResponse {
    private UUID id;
    private UUID issueId;
    private Integer riskNumber;
    /** Display id e.g. R1 */
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
