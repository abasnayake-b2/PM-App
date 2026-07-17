package com.nexuspm.issue.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Data
public class UpdateIssueRequest {

    private String title;
    private String description;
    private UUID priorityId;
    private UUID assignedToId;
    private Boolean clearAssignedTo;
    private UUID releaseId;
    private Boolean clearRelease;
    private BigDecimal originalEstimation;
    private BigDecimal actualEstimation;
    private Boolean capitalizable;
    private String component;
    private Boolean clearOriginalEstimation;
    private Boolean clearActualEstimation;
    private Boolean clearComponent;

    /** Custom RD field values keyed by fieldKey. Null means leave unchanged. */
    private Map<String, String> customFields;
}
