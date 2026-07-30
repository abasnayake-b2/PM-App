package com.nexuspm.issue.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateIssueRiskRequest {

    @Size(max = 4000)
    private String description;

    private LocalDate createdDate;
    private Boolean clearCreatedDate;

    @Size(max = 120)
    private String owner;
    private Boolean clearOwner;

    @Size(max = 40)
    private String status;
    private Boolean clearStatus;

    @Size(max = 40)
    private String impact;
    private Boolean clearImpact;

    private LocalDate closedDate;
    private Boolean clearClosedDate;

    @Size(max = 4000)
    private String mitigation;
    private Boolean clearMitigation;
}
