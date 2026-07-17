package com.nexuspm.resource.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateAllocationRequest {

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
