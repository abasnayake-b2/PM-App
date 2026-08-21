package com.nexuspm.issue.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class IssueQuarterlyCompletionResponse {
    private UUID id;
    private UUID issueId;
    private Integer year;
    private Integer quarter;
    /** Display label e.g. 2025 Q3 */
    private String displayKey;
    private BigDecimal percentage;
    private Instant createdAt;
    private Instant updatedAt;
}
