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
    private String issueDisplayKey;
    private UUID projectId;
    private String projectName;
    private UUID projectTaskId;
    private String projectTaskKey;
    private String projectTaskDescription;
    private UUID rdIssueTaskId;
    private String rdIssueTaskKey;
    private String rdIssueTaskDescription;
    private UUID taskTypeId;
    private String taskTypeName;
    private UUID taskCategoryId;
    private String taskCategoryName;
    private UUID nonProjectTaskId;
    private String nonProjectTaskDescription;
    private String roleOnProject;
    private Integer percentage;
    private LocalDate fromDate;
    private LocalDate toDate;
    private boolean billable;
}
