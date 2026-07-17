package com.nexuspm.user.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class EligibleManagementOption {

    private UUID id;
    private String roleTitle;
    private String firstName;
    private String lastName;
    private String fullName;
    private String supervisorName;
    private String supervisorFullName;
    private UUID supervisorManagementId;
    private UUID supervisorEmployeeId;
    private String supervisorEmployeeName;
    private String status;
}
