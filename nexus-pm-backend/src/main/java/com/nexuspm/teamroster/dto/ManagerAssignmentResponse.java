package com.nexuspm.teamroster.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class ManagerAssignmentResponse {
    private UUID id;
    private UUID employeeId;
    private String employeeName;
    private String designationCode;
    private String designation;
    private String status;
    private UUID engineeringManagerManagementId;
    private String engineeringManagerName;
    private String vpName;
    private LocalDate fromDate;
    private LocalDate toDate;
    private String source;
}
