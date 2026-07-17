package com.nexuspm.user.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdateUserAccountRequest {

    private String email;
    private String status;
    private String roleCode;
    private UUID departmentId;
    private UUID designationId;
    private UUID managerId;
    private String password;
    /** Manager-only: own team vs org-wide visibility. */
    private Boolean orgWideVisibility;
}
