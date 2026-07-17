package com.nexuspm.user;

import com.nexuspm.admin.repository.SystemSettingRepository;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.notification.repository.NotificationRepository;
import com.nexuspm.project.repository.ProjectAccessRepository;
import com.nexuspm.project.repository.ProjectHealthLogRepository;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.resource.repository.AllocationRepository;
import com.nexuspm.resource.repository.TaskRepository;
import com.nexuspm.resource.repository.TimeLogRepository;
import com.nexuspm.shared.audit.repository.AuditLogRepository;
import com.nexuspm.user.repository.EmployeeRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmployeeCleanupService {

    private final AllocationRepository allocationRepository;
    private final TimeLogRepository timeLogRepository;
    private final NotificationRepository notificationRepository;
    private final ProjectAccessRepository projectAccessRepository;
    private final RdIssueRepository issueRepository;
    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final ProjectHealthLogRepository projectHealthLogRepository;
    private final AuditLogRepository auditLogRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final EmployeeRepository employeeRepository;
    private final EntityManager entityManager;

    @Transactional
    public void detachEmployeesForDeletion(Collection<UUID> employeeIds) {
        if (employeeIds == null || employeeIds.isEmpty()) {
            return;
        }
        List<UUID> ids = employeeIds.stream().distinct().toList();

        allocationRepository.deleteByEmployeeIdIn(ids);
        timeLogRepository.deleteByEmployeeIdIn(ids);
        notificationRepository.deleteByEmployeeIdIn(ids);
        projectAccessRepository.deleteByEmployeeIdIn(ids);
        issueRepository.clearAssigneeByEmployeeIds(ids);
        issueRepository.clearReporterByEmployeeIds(ids);
        taskRepository.clearAssigneeByEmployeeIds(ids);
        projectRepository.clearLeadEmployeeByEmployeeIds(ids);
        projectRepository.clearArchitectEmployeeByEmployeeIds(ids);
        projectHealthLogRepository.clearChangedByEmployeeIds(ids);
        auditLogRepository.clearEmployeeReferences(ids);
        systemSettingRepository.clearUpdatedByEmployeeIds(ids);
        employeeRepository.clearManagerReferences(ids);
        employeeRepository.deleteRoleLinks(ids);
        employeeRepository.deleteSkillLinks(ids);
        entityManager.flush();
    }
}
