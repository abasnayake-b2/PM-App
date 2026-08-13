package com.nexuspm.project.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class ProjectResponse {

    private UUID id;
    private String name;
    private String product;
    private String jiraProjectKey;
    private String status;
    private String ragStatus;
    private Integer progressPct;
    /** ISSUES = from terminal issue statuses; SCHEDULE = elapsed project dates; NONE = no data */
    private String progressBasis;
    private LocalDate startDate;
    private LocalDate endDate;
    private boolean archived;
    private boolean deleted;
    private UUID clientId;
    private String clientName;
    private UUID regionId;
    private String regionName;
    private String countryName;
    private UUID leadEmployeeId;
    private String leadEmployeeName;
    private UUID architectEmployeeId;
    private String architectEmployeeName;
    private UUID vpManagementId;
    private String vpName;
    private UUID engineeringManagerManagementId;
    private String engineeringManagerName;
    private BigDecimal budgetAmount;
    private String budgetCurrency;
    private int teamSize;
    private int backlogItemCount;
    private int issuesWithoutUtilizationCount;
    private Instant createdAt;
    private Instant updatedAt;
}
