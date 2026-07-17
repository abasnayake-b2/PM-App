package com.nexuspm.user.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class EmployeeResponse {

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
}
