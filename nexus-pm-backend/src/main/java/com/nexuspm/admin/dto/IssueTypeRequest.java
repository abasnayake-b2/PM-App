package com.nexuspm.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class IssueTypeRequest {

    @NotBlank
    private String name;

    @NotBlank
    private String workflowCode;

    private String description;
}
