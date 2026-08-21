package com.nexuspm.issue.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreateIssueQuarterlyCompletionRequest {

    @NotNull
    @Min(2000)
    @Max(2100)
    private Integer year;

    @NotNull
    @Min(1)
    @Max(4)
    private Integer quarter;

    @NotNull
    @DecimalMin("0")
    @DecimalMax("100")
    private BigDecimal percentage;
}
