package com.nexuspm.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class ProjectAccessRequest {

    @NotNull
    private UUID employeeId;

    @NotBlank
    private String accessLevel;
}
