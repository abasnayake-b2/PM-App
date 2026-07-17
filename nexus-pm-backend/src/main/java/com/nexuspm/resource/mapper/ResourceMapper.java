package com.nexuspm.resource.mapper;

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
        var issue = allocation.getIssue();
        var project = issue.getProject();
        return AllocationResponse.builder()
                .id(allocation.getId())
                .employeeId(employee.getId())
                .employeeName(employee.getFirstName() + " " + employee.getLastName())
                .issueId(issue.getId())
                .issueTitle(issue.getTitle())
                .projectId(project.getId())
                .projectName(project.getName())
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
}
