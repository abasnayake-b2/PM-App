package com.nexuspm.report.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DashboardSummaryResponse {

    private long activeProjects;
    private long openIssues;
    private int teamUtilisationPct;
    private long unreadNotifications;
    private long overAllocatedEmployees;
}
