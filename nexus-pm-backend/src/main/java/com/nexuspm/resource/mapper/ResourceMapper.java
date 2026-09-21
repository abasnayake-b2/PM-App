package com.nexuspm.resource.mapper;

import com.nexuspm.issue.IssueDisplayKeys;
import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.entity.RdIssueTask;
import com.nexuspm.project.entity.Project;
import com.nexuspm.project.entity.ProjectTask;
import com.nexuspm.resource.dto.AllocationResponse;
import com.nexuspm.resource.dto.TimeLogResponse;
import com.nexuspm.resource.entity.Allocation;
import com.nexuspm.resource.entity.TimeLog;
import com.nexuspm.user.entity.Employee;
import org.springframework.stereotype.Component;

@Component
public class ResourceMapper {

    public AllocationResponse toResponse(Allocation allocation) {
        Employee employee = allocation.getEmployee();
        Project project = allocation.getProject();
        RdIssue issue = allocation.getIssue();
        ProjectTask projectTask = allocation.getProjectTask();
        RdIssueTask rdTask = allocation.getRdIssueTask();

        String projectTaskKey = projectTask != null
                ? IssueDisplayKeys.projectTaskKey(project, projectTask.getTaskNumber())
                : null;
        String rdTaskKey = rdTask != null
                ? IssueDisplayKeys.rdTaskKey(issue != null ? issue.getDisplayKey() : null, rdTask.getTaskNumber())
                : null;

        return AllocationResponse.builder()
                .id(allocation.getId())
                .employeeId(employee.getId())
                .employeeName(employee.getFirstName() + " " + employee.getLastName())
                .issueId(issue != null ? issue.getId() : null)
                .issueTitle(targetTitle(allocation, project, issue, projectTask, rdTask, projectTaskKey, rdTaskKey))
                .issueDisplayKey(issue != null ? issue.getDisplayKey() : null)
                .projectId(project.getId())
                .projectName(project.getName())
                .projectTaskId(projectTask != null ? projectTask.getId() : null)
                .projectTaskKey(projectTaskKey)
                .projectTaskDescription(projectTask != null ? projectTask.getDescription() : null)
                .rdIssueTaskId(rdTask != null ? rdTask.getId() : null)
                .rdIssueTaskKey(rdTaskKey)
                .rdIssueTaskDescription(rdTask != null ? rdTask.getDescription() : null)
                .roleOnProject(allocation.getRoleOnProject())
                .percentage(allocation.getPercentage())
                .fromDate(allocation.getFromDate())
                .toDate(allocation.getToDate())
                .billable(allocation.isBillable())
                .build();
    }

    public TimeLogResponse toResponse(TimeLog log) {
        Employee employee = log.getEmployee();
        var issue = log.getTask().getIssue();
        var project = issue.getProject();
        return TimeLogResponse.builder()
                .id(log.getId())
                .employeeId(employee.getId())
                .employeeName(employee.getFirstName() + " " + employee.getLastName())
                .taskId(log.getTask().getId())
                .taskTitle(log.getTask().getTitle())
                .issueId(issue.getId())
                .issueTitle(issue.getTitle())
                .projectId(project.getId())
                .projectName(project.getName())
                .logDate(log.getLogDate())
                .hours(log.getHours())
                .notes(log.getNotes())
                .build();
    }

    public static String targetTitle(Allocation allocation) {
        Project project = allocation.getProject();
        RdIssue issue = allocation.getIssue();
        ProjectTask projectTask = allocation.getProjectTask();
        RdIssueTask rdTask = allocation.getRdIssueTask();
        String projectTaskKey = projectTask != null && project != null
                ? IssueDisplayKeys.projectTaskKey(project, projectTask.getTaskNumber())
                : null;
        String rdTaskKey = rdTask != null
                ? IssueDisplayKeys.rdTaskKey(issue != null ? issue.getDisplayKey() : null, rdTask.getTaskNumber())
                : null;
        return targetTitle(allocation, project, issue, projectTask, rdTask, projectTaskKey, rdTaskKey);
    }

    private static String targetTitle(
            Allocation allocation,
            Project project,
            RdIssue issue,
            ProjectTask projectTask,
            RdIssueTask rdTask,
            String projectTaskKey,
            String rdTaskKey) {
        if (rdTask != null) {
            String desc = rdTask.getDescription() != null ? rdTask.getDescription().trim() : "";
            return desc.isEmpty() ? rdTaskKey : rdTaskKey + " — " + desc;
        }
        if (projectTask != null) {
            String desc = projectTask.getDescription() != null ? projectTask.getDescription().trim() : "";
            return desc.isEmpty() ? projectTaskKey : projectTaskKey + " — " + desc;
        }
        if (issue != null) {
            String key = issue.getDisplayKey();
            String title = issue.getTitle();
            if (key != null && !key.isBlank() && title != null && !title.isBlank()) {
                return key.trim() + " — " + title;
            }
            if (title != null && !title.isBlank()) {
                return title;
            }
            if (key != null && !key.isBlank()) {
                return key.trim();
            }
        }
        if (project != null && project.getName() != null && !project.getName().isBlank()) {
            return project.getName();
        }
        return allocation.getId() != null ? allocation.getId().toString() : "Allocation";
    }
}
