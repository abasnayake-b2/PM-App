package com.nexuspm.issue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateIssueTaskRequest {

    @NotBlank
    @Size(max = 4000)
    private String description;

    @Size(max = 120)
    private String module;
}
