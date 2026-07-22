package com.nexuspm.report;

import com.nexuspm.report.dto.CapacityUtilisationDashboard;
import com.nexuspm.report.dto.DashboardOverviewResponse;
import com.nexuspm.report.dto.DashboardSummaryResponse;
import com.nexuspm.report.dto.EmCapacityPlanDashboard;
import com.nexuspm.report.dto.UpdateAdditionalResourcesRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    private final CapacityUtilisationService capacityUtilisationService;
    private final EmCapacityPlanningService emCapacityPlanningService;

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

    @GetMapping("/dashboard/em-capacity-plan")
    @PreAuthorize("@perm.can('REPORTS_VIEW') and @perm.can('PROJECTS_VIEW')")
    public EmCapacityPlanDashboard emCapacityPlan(
            @RequestParam(required = false) Integer weeks) {
        return emCapacityPlanningService.getDashboard(weeks);
    }

    @PutMapping("/dashboard/em-capacity-plan/{emId}/additional-resources")
    @PreAuthorize("@perm.can('REPORTS_VIEW') and @perm.can('PROJECTS_VIEW')")
    public EmCapacityPlanDashboard.EmColumn updateAdditionalResources(
            @PathVariable UUID emId,
            @Valid @RequestBody UpdateAdditionalResourcesRequest request) {
        return emCapacityPlanningService.updateAdditionalResources(emId, request.getAdditionalResources());
    }
}
