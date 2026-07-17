package com.nexuspm.user.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class UserAccountResponse {

    private UUID id;
    private String email;
    private String firstName;
    private String lastName;
    private String fullName;
    private String status;
    private String roleCode;
    private UUID departmentId;
    private String departmentName;
    private UUID designationId;
    private String designationName;
    private UUID managerId;
    private String managerName;
    private UUID managementId;
    private String managementRoleTitle;
    private String managementFullName;
    private boolean authActive;
    private int failedLoginAttempts;
    private Instant lockedUntil;
    private boolean accountLocked;
    /** Manager-only: when true, see org-wide roster/projects like a VP. */
    private boolean orgWideVisibility;
}
