package com.nexuspm.teamroster.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class DemoteManagementToEmployeeRequest {

    /** Optional engineering manager on the management roster after demotion. */
    private UUID engineeringManagerManagementId;

    /**
     * When the person has a login, set their app role to EMPLOYEE (default true).
     */
    private Boolean setEmployeeRole = true;
}
