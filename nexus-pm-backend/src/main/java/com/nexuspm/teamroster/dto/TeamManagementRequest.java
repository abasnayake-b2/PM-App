package com.nexuspm.teamroster.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class TeamManagementRequest {
    @NotBlank
    private String roleTitle;
    @NotBlank
    private String firstName;
    @NotBlank
    private String lastName;
    private String supervisorName;
    private UUID supervisorId;
    private String status;
    private String employmentType;
}
