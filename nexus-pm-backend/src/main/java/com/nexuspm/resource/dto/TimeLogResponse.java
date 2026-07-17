package com.nexuspm.resource.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class TimeLogResponse {

    private UUID id;
    private UUID employeeId;
    private String employeeName;
    private UUID taskId;
    private String taskTitle;
    private UUID issueId;
    private String issueTitle;
    private UUID projectId;
    private String projectName;
    private LocalDate logDate;
    private BigDecimal hours;
    private String notes;
}
