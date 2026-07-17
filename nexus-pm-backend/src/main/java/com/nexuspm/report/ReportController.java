package com.nexuspm.report;

import com.nexuspm.report.dto.CapacityUtilisationDashboard;
import com.nexuspm.report.dto.DashboardOverviewResponse;
import com.nexuspm.report.dto.DashboardSummaryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    private final CapacityUtilisationService capacityUtilisationService;

    @GetMapping("/dashboard")
    @PreAuthorize("@perm.can('REPORTS_VIEW')")
    public DashboardSummaryResponse dashboard() {
        return reportService.getDashboardSummary();
    }

    @GetMapping("/dashboard/overview")
    @PreAuthorize("@perm.can('REPORTS_VIEW')")
    public DashboardOverviewResponse dashboardOverview() {
        return reportService.getDashboardOverview();
    }

    @GetMapping("/dashboard/capacity-utilisation")
    @PreAuthorize("@perm.can('REPORTS_VIEW') and @perm.can('ALLOCATIONS_VIEW')")
    public CapacityUtilisationDashboard capacityUtilisation(
            @RequestParam(required = false) Integer weeks) {
        return capacityUtilisationService.getDashboard(weeks);
    }
}
