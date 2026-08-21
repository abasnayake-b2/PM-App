package com.nexuspm.issue.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
public class IssueResponse {

    private UUID id;
    /** Human-readable key e.g. SABI-GBL-RD-1 */
    private String displayKey;
    private Integer rdNumber;
    private Integer childNumber;
    private String title;
    private String jiraId;
    private String bmsId;
    private String description;
    private UUID releaseId;
    private String releaseName;
    private UUID parentIssueId;
    private String parentIssueTitle;
    private String parentIssueTypeWorkflowCode;
    private UUID projectId;
    private String projectName;
    private UUID issueTypeId;
    private String issueTypeName;
    private String issueTypeWorkflowCode;
    private UUID priorityId;
    private String priorityLabel;
    private String priorityColour;
    private UUID statusId;
    private String statusName;
    private String statusColour;
    private UUID reportedById;
    private String reportedByName;
    private UUID assignedToId;
    private String assignedToName;
    /** Comma-separated names from active resource allocations on this issue. */
    private String allocatedToNames;
    /** Sum of active allocation percentages on this issue. */
    private Integer utilizationPct;
    private BigDecimal originalEstimation;
    private BigDecimal actualEstimation;
    private Boolean capitalizable;
    private String component;
    /** Custom RD field values keyed by fieldKey. */
    private Map<String, String> customFields;
    private boolean deleted;
    private Instant slaDueAt;
    private String slaStatus;
    private Instant createdAt;
    private Instant updatedAt;
}
