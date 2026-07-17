package com.nexuspm.project.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
public class UpdateProjectRequest {

    @NotBlank
    private String name;

    private String product;

    private UUID leadEmployeeId;
    private UUID architectEmployeeId;
    private UUID engineeringManagerManagementId;
    private String status;
    private Integer progressPct;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal budgetAmount;
    private String budgetCurrency;
}
