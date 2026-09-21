package com.nexuspm.issue.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class IssueTaskResponse {
    private UUID id;
    private UUID issueId;
    private Integer taskNumber;
    /** Display id e.g. ABIC-GBL-RD-1-RT-1 */
    private String displayKey;
    private String description;
    private String module;
    private Instant createdAt;
    private Instant updatedAt;
}
