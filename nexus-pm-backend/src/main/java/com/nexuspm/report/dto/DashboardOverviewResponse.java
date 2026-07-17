package com.nexuspm.report.dto;

import com.nexuspm.notification.dto.NotificationResponse;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class DashboardOverviewResponse {
    private DashboardSummaryResponse summary;
    private List<ProjectDashboardItem> projects;
    private List<NotificationResponse> recentNotifications;
    private List<UtilisationSnapshot> utilisation;
    private OrgWorkforceSummary orgWorkforce;
    private List<VpOrgBreakdownRow> vpBreakdown;
    private List<EmOrgBreakdownRow> emBreakdown;
    private Instant generatedAt;
}
