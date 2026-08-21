package com.nexuspm.issue.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateIssueQuarterlyCompletionRequest {

    @Min(2000)
    @Max(2100)
    private Integer year;

    @Min(1)
    @Max(4)
    private Integer quarter;

    @DecimalMin("0")
    @DecimalMax("100")
    private BigDecimal percentage;
}
