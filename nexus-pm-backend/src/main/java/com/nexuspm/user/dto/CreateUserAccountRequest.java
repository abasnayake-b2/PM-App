package com.nexuspm.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CreateUserAccountRequest {

    /** Link a management-roster person (creates a new employee row). Mutually exclusive with employeeId. */
    private UUID managementId;

    /** Give login to an existing employee-roster person. Mutually exclusive with managementId. */
    private UUID employeeId;

    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String password;

    /**
     * Primary / single role (backward compatible). Prefer {@link #roleCodes} when assigning multiple.
     * At least one of roleCode or roleCodes is required.
     */
    private String roleCode;

    /** One or more application roles. Permissions are the union of all assigned roles. */
    private List<String> roleCodes;

    private UUID departmentId;
    private UUID designationId;
    private UUID managerId;
    /** Manager / PM / VP: own team vs org-wide visibility. */
    private Boolean orgWideVisibility;
}
