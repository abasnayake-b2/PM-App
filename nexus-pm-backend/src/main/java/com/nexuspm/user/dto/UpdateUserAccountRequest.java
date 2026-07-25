package com.nexuspm.user.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class UpdateUserAccountRequest {

    private String email;
    private String status;
    /** Primary / single role (backward compatible). Prefer {@link #roleCodes}. */
    private String roleCode;
    /** Replace all assigned roles when provided (must be non-empty). */
    private List<String> roleCodes;
    private UUID departmentId;
    private UUID designationId;
    private UUID managerId;
    private String password;
    /** Manager-only: own team vs org-wide visibility. */
    private Boolean orgWideVisibility;
}
