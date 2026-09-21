package com.nexuspm.resource.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
public class CreateAllocationRequest {

    @NotNull
    private UUID employeeId;

    /** RD to allocate on. Omit when allocating to a project-level task. */
    private UUID issueId;

    /** Project-level task. Mutually exclusive with issueId / rdIssueTaskId. */
    private UUID projectTaskId;

    /** RD-level task on the selected issue. */
    private UUID rdIssueTaskId;

    private String roleOnProject;

    @NotNull
    @Min(1)
    @Max(100)
    private Integer percentage;

    @NotNull
    private LocalDate fromDate;

    @NotNull
    private LocalDate toDate;

    private Boolean billable;
}
