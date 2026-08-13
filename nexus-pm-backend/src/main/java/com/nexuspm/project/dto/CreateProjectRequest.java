package com.nexuspm.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class CreateProjectRequest {

    @NotNull
    private UUID clientId;

    @NotBlank
    private String name;

    private String product;

    private String jiraProjectKey;

    @NotNull
    private UUID leadEmployeeId;

    private UUID architectEmployeeId;
    private UUID engineeringManagerManagementId;

    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal budgetAmount;
    private String budgetCurrency;
    private List<ProjectAccessRequest> teamAccess;
}
