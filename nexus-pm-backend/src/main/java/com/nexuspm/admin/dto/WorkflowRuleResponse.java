package com.nexuspm.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class WorkflowRuleResponse {

    private UUID id;
    private UUID issueTypeId;
    private String issueTypeName;
    private UUID fromStatusId;
    private String fromStatusName;
    private UUID toStatusId;
    private String toStatusName;
}

