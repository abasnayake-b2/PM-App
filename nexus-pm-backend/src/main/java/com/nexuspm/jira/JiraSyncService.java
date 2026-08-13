package com.nexuspm.jira;

import com.nexuspm.issue.IssueKeyAllocator;
import com.nexuspm.issue.IssueLifecycleStatuses;
import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.jira.dto.JiraSyncResult;
import com.nexuspm.lookup.IssueTypeCatalog;
import com.nexuspm.lookup.entity.IssueStatus;
import com.nexuspm.lookup.entity.IssueType;
import com.nexuspm.lookup.entity.Priority;
import com.nexuspm.lookup.repository.IssueStatusRepository;
import com.nexuspm.lookup.repository.IssueTypeRepository;
import com.nexuspm.lookup.repository.PriorityRepository;
import com.nexuspm.project.ProjectService;
import com.nexuspm.project.entity.Project;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JiraSyncService {

    private final DfnPmProperties properties;
    private final JiraClient jiraClient;
    private final ProjectService projectService;
    private final ProjectRepository projectRepository;
    private final RdIssueRepository issueRepository;
    private final IssueTypeRepository issueTypeRepository;
    private final PriorityRepository priorityRepository;
    private final IssueStatusRepository issueStatusRepository;
    private final EmployeeRepository employeeRepository;
    private final IssueKeyAllocator issueKeyAllocator;
    private final AuditLogService auditLogService;

    @Transactional
    public JiraSyncResult syncProject(UUID projectId) {
        DfnPmProperties.Jira jira = properties.getJira();
        if (!jira.isEnabled()) {
            throw new BusinessException("JIRA_DISABLED", "Jira sync is disabled. Set JIRA_ENABLED=true.", 400);
        }
        if (isBlank(jira.getBaseUrl()) || isBlank(jira.getEmail()) || isBlank(jira.getApiToken())) {
            throw new BusinessException(
                    "JIRA_CONFIG",
                    "Jira is not configured. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN.",
                    400);
        }

        projectService.getProject(projectId);
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Project not found", 404));
        if (isBlank(project.getJiraProjectKey())) {
            throw new BusinessException(
                    "JIRA_PROJECT_KEY_MISSING",
                    "Set a Jira project key on this project before syncing.",
                    400);
        }

        UUID userId = SecurityUtils.currentUserId();
        if (userId == null) {
            throw new BusinessException("ACCESS_DENIED", "Authenticated user required", 403);
        }
        Employee reporter = employeeRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Current user not found", 404));

        IssueType changeType = resolveChangeIssueType();
        IssueStatus defaultStatus = issueStatusRepository.findByName(IssueLifecycleStatuses.DEFAULT_STATUS)
                .orElseThrow(() -> new BusinessException("CONFIG_ERROR", "Default status not configured", 500));
        Map<String, Priority> prioritiesByLabel = indexPrioritiesByLabel();
        Priority defaultPriority = resolveDefaultPriority(prioritiesByLabel);

        List<JiraClient.JiraIssueSummary> remoteIssues = jiraClient.searchCrIssues(
                project.getJiraProjectKey(),
                jira.resolvedCrIssueTypeNames());

        int created = 0;
        int updated = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        for (JiraClient.JiraIssueSummary remote : remoteIssues) {
            try {
                if (isBlank(remote.key()) || isBlank(remote.summary())) {
                    skipped++;
                    errors.add("Skipped issue with missing key or summary");
                    continue;
                }

                Optional<RdIssue> existing = issueRepository
                        .findByProjectIdAndJiraIdIgnoreCaseAndDeletedFalse(projectId, remote.key());
                if (existing.isPresent()) {
                    RdIssue issue = existing.get();
                    String nextTitle = remote.summary().trim();
                    boolean changed = false;
                    if (!nextTitle.equals(issue.getTitle())) {
                        issue.setTitle(nextTitle);
                        changed = true;
                    }
                    if (remote.description() != null
                            && (issue.getDescription() == null || issue.getDescription().isBlank())) {
                        issue.setDescription(remote.description());
                        changed = true;
                    }
                    if (changed) {
                        issueRepository.save(issue);
                        auditLogService.log(
                                userId, "UPDATE", "ISSUE", issue.getId(), issue.getTitle(), "Jira sync");
                        updated++;
                    } else {
                        skipped++;
                    }
                    continue;
                }

                Priority priority = mapPriority(remote.priorityName(), prioritiesByLabel, defaultPriority);
                RdIssue issue = new RdIssue();
                issue.setId(UUID.randomUUID());
                issue.setProject(project);
                issue.setTitle(remote.summary().trim());
                issue.setJiraId(remote.key().trim());
                issue.setDescription(remote.description());
                issue.setIssueType(changeType);
                issue.setPriority(priority);
                issue.setStatus(defaultStatus);
                issue.setReportedBy(reporter);
                issue.setSlaDueAt(Instant.now().plus(priority.getSlaResolveHrs(), ChronoUnit.HOURS));
                issue.setSlaStatus("WITHIN");
                issueKeyAllocator.assign(issue, project, null, changeType.getWorkflowCode());
                issueRepository.save(issue);
                auditLogService.log(userId, "CREATE", "ISSUE", issue.getId(), issue.getTitle(), "Jira sync");
                created++;
            } catch (Exception e) {
                skipped++;
                errors.add(remote.key() + ": " + e.getMessage());
            }
        }

        return JiraSyncResult.builder()
                .fetched(remoteIssues.size())
                .created(created)
                .updated(updated)
                .skipped(skipped)
                .errors(errors)
                .syncedByName(reporter.getFullName())
                .syncedAt(Instant.now())
                .build();
    }

    private IssueType resolveChangeIssueType() {
        for (IssueType issueType : IssueTypeCatalog.filterAndSort(issueTypeRepository.findAll())) {
            if ("CHANGE".equalsIgnoreCase(issueType.getWorkflowCode())) {
                return issueType;
            }
        }
        throw new BusinessException("CONFIG_ERROR", "Change Request issue type is not configured", 500);
    }

    private Map<String, Priority> indexPrioritiesByLabel() {
        Map<String, Priority> byLabel = new HashMap<>();
        for (Priority priority : priorityRepository.findAllByOrderByLevelAsc()) {
            byLabel.put(normalizeToken(priority.getLabel()), priority);
        }
        return byLabel;
    }

    private static Priority resolveDefaultPriority(Map<String, Priority> prioritiesByLabel) {
        Priority medium = prioritiesByLabel.get("medium");
        if (medium != null) {
            return medium;
        }
        return prioritiesByLabel.values().stream()
                .findFirst()
                .orElseThrow(() -> new BusinessException("CONFIG_ERROR", "No priorities configured", 500));
    }

    private static Priority mapPriority(
            String jiraPriorityName, Map<String, Priority> prioritiesByLabel, Priority defaultPriority) {
        if (isBlank(jiraPriorityName)) {
            return defaultPriority;
        }
        String token = normalizeToken(jiraPriorityName);
        Priority direct = prioritiesByLabel.get(token);
        if (direct != null) {
            return direct;
        }
        return switch (token) {
            case "highest", "blocker" -> firstPresent(prioritiesByLabel, defaultPriority, "critical", "highest", "high");
            case "high" -> firstPresent(prioritiesByLabel, defaultPriority, "high");
            case "low" -> firstPresent(prioritiesByLabel, defaultPriority, "low");
            case "lowest", "trivial" -> firstPresent(prioritiesByLabel, defaultPriority, "lowest", "low");
            default -> defaultPriority;
        };
    }

    private static Priority firstPresent(
            Map<String, Priority> prioritiesByLabel, Priority fallback, String... labels) {
        for (String label : labels) {
            Priority priority = prioritiesByLabel.get(label);
            if (priority != null) {
                return priority;
            }
        }
        return fallback;
    }

    private static String normalizeToken(String value) {
        return value.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
