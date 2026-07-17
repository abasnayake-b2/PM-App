package com.nexuspm.issue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Data
public class CreateIssueRequest {

    @NotNull
    private UUID projectId;

    private UUID releaseId;

    @NotBlank
    private String title;

    private String description;

    @NotNull
    private UUID issueTypeId;

    private UUID parentIssueId;

    @NotNull
    private UUID priorityId;

    private UUID assignedToId;

    private BigDecimal originalEstimation;

    private BigDecimal actualEstimation;

    private Boolean capitalizable;

    private String component;

    /** Custom RD field values keyed by fieldKey. */
    private Map<String, String> customFields;
}
