package com.nexuspm.resource.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class AllocationResponse {

    private UUID id;
    private UUID employeeId;
    private String employeeName;
    private UUID issueId;
    private String issueTitle;
    private UUID projectId;
    private String projectName;
    private String roleOnProject;
    private Integer percentage;
    private LocalDate fromDate;
    private LocalDate toDate;
    private boolean billable;
}
