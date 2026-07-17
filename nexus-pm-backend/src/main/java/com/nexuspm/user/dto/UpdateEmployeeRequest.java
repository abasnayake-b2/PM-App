package com.nexuspm.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class UpdateEmployeeRequest {

    @NotBlank
    private String firstName;

    @NotBlank
    private String lastName;

    private String status;
    private String roleCode;
    private UUID departmentId;
    private UUID designationId;
    private UUID managerId;
    private String password;
}
