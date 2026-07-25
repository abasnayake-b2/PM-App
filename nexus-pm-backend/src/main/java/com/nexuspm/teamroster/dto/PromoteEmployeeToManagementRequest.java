package com.nexuspm.teamroster.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class PromoteEmployeeToManagementRequest {

    @NotBlank
    private String roleTitle;

    /** Optional app role (CXO / VP / MANAGER / …) applied when the person already has a login. */
    private String roleCode;

    private UUID supervisorId;
    private String status;
}
