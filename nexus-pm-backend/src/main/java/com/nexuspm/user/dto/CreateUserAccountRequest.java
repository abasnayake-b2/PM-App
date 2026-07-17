package com.nexuspm.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateUserAccountRequest {

    @NotNull
    private UUID managementId;

    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String password;

    @NotBlank
    private String roleCode;

    private UUID departmentId;
    private UUID designationId;
    private UUID managerId;
    /** Manager-only: own team vs org-wide visibility. */
    private Boolean orgWideVisibility;
}
