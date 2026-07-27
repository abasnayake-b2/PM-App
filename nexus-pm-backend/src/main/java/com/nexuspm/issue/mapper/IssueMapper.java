package com.nexuspm.issue.mapper;

import com.nexuspm.issue.dto.IssueResponse;
import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.user.entity.Employee;
import org.springframework.stereotype.Component;

@Component
public class IssueMapper {

    public IssueResponse toResponse(RdIssue issue) {
        var project = issue.getProject();
        var release = issue.getRelease();
        var parent = issue.getParentIssue();
        return IssueResponse.builder()
                .id(issue.getId())
                .displayKey(issue.getDisplayKey())
                .rdNumber(issue.getRdNumber())
                .childNumber(issue.getChildNumber())
                .title(issue.getTitle())
                .jiraId(issue.getJiraId())
                .description(issue.getDescription())
                .releaseId(release != null ? release.getId() : null)
                .releaseName(release != null ? release.getName() : null)
                .parentIssueId(parent != null ? parent.getId() : null)
                .parentIssueTitle(parent != null ? parent.getTitle() : null)
                .parentIssueTypeWorkflowCode(
                        parent != null && parent.getIssueType() != null
                                ? parent.getIssueType().getWorkflowCode()
                                : null)
                .projectId(project.getId())
                .projectName(project.getName())
                .issueTypeId(issue.getIssueType().getId())
                .issueTypeName(issue.getIssueType().getName())
                .issueTypeWorkflowCode(issue.getIssueType().getWorkflowCode())
                .priorityId(issue.getPriority().getId())
                .priorityLabel(issue.getPriority().getLabel())
                .priorityColour(issue.getPriority().getColour())
                .statusId(issue.getStatus().getId())
                .statusName(issue.getStatus().getName())
                .statusColour(issue.getStatus().getColour())
                .reportedById(issue.getReportedBy() != null ? issue.getReportedBy().getId() : null)
                .reportedByName(employeeName(issue.getReportedBy()))
                .assignedToId(issue.getAssignedTo() != null ? issue.getAssignedTo().getId() : null)
                .assignedToName(employeeName(issue.getAssignedTo()))
                .originalEstimation(issue.getOriginalEstimation())
                .actualEstimation(issue.getActualEstimation())
                .capitalizable(issue.getCapitalizable())
                .component(issue.getComponent())
                .deleted(issue.isDeleted())
                .slaDueAt(issue.getSlaDueAt())
                .slaStatus(issue.getSlaStatus())
                .createdAt(issue.getCreatedAt())
                .updatedAt(issue.getUpdatedAt())
                .build();
    }

    private String employeeName(Employee employee) {
        if (employee == null) {
            return null;
        }
        return employee.getFirstName() + " " + employee.getLastName();
    }
}
