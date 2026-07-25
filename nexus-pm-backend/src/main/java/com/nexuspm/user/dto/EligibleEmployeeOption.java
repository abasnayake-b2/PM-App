package com.nexuspm.user.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class EligibleEmployeeOption {

    private UUID id;
    private String firstName;
    private String lastName;
    private String fullName;
    private String email;
    private UUID departmentId;
    private String departmentName;
    private UUID designationId;
    private String designationName;
    private UUID managerId;
    private String managerName;
    private String engineeringManagerName;
    private UUID managementId;
    private String managementRoleTitle;
    private String status;
}
