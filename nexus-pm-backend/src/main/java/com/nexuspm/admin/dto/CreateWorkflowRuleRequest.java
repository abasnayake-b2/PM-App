package com.nexuspm.admin.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateWorkflowRuleRequest {

    @NotNull
    private UUID issueTypeId;

    @NotNull
    private UUID fromStatusId;

    @NotNull
    private UUID toStatusId;
}
