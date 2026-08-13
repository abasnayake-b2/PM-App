package com.nexuspm.project.mapper;

import com.nexuspm.project.dto.ProjectHealthLogResponse;
import com.nexuspm.project.dto.ProjectResponse;
import com.nexuspm.project.entity.Budget;
import com.nexuspm.project.entity.Project;
import com.nexuspm.project.entity.ProjectHealthLog;
import com.nexuspm.report.ManagementHierarchyUtils;
import com.nexuspm.teamroster.entity.TeamManagement;
import org.springframework.stereotype.Component;

@Component
public class ProjectMapper {

    public ProjectResponse toResponse(Project project, Budget budget, int teamSize) {
        TeamManagement em = project.getEngineeringManagerManagement();
        TeamManagement vp = ManagementHierarchyUtils.resolveVpFromEngineeringManager(em);
        return ProjectResponse.builder()
                .id(project.getId())
                .name(project.getName())
                .product(project.getProduct())
                .jiraProjectKey(project.getJiraProjectKey())
                .status(project.getStatus())
                .ragStatus(project.getRagStatus())
                .startDate(project.getStartDate())
                .endDate(project.getEndDate())
                .archived(project.isArchived())
                .deleted(project.isDeleted())
                .clientId(project.getClient().getId())
                .clientName(project.getClient().getName())
                .regionId(project.getClient().getCountry().getRegion().getId())
                .regionName(project.getClient().getCountry().getRegion().getName())
                .countryName(project.getClient().getCountry().getName())
                .leadEmployeeId(project.getLeadEmployee() != null ? project.getLeadEmployee().getId() : null)
                .leadEmployeeName(project.getLeadEmployee() != null ? project.getLeadEmployee().getFullName() : null)
                .architectEmployeeId(project.getArchitectEmployee() != null ? project.getArchitectEmployee().getId() : null)
                .architectEmployeeName(project.getArchitectEmployee() != null ? project.getArchitectEmployee().getFullName() : null)
                .vpManagementId(vp != null ? vp.getId() : null)
                .vpName(vp != null ? vp.getFullName() : null)
                .engineeringManagerManagementId(em != null ? em.getId() : null)
                .engineeringManagerName(em != null ? em.getFullName() : null)
                .budgetAmount(budget != null ? budget.getAmount() : null)
                .budgetCurrency(budget != null ? budget.getCurrency() : null)
                .teamSize(teamSize)
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .build();
    }

    public ProjectHealthLogResponse toResponse(ProjectHealthLog log) {
        return ProjectHealthLogResponse.builder()
                .id(log.getId())
                .ragStatus(log.getRagStatus())
                .notes(log.getNotes())
                .changedById(log.getChangedBy() != null ? log.getChangedBy().getId() : null)
                .changedByName(log.getChangedBy() != null ? log.getChangedBy().getFullName() : null)
                .createdAt(log.getCreatedAt())
                .build();
    }
}
