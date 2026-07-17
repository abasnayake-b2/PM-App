package com.nexuspm.report.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class ProjectDashboardItem {
    private UUID id;
    private String name;
    private String clientName;
    private String ragStatus;
    private Integer progressPct;
    private String status;
    private long openIssues;
}
