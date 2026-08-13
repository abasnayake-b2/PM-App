package com.nexuspm.jira;

import com.fasterxml.jackson.databind.JsonNode;
import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.jira.dto.JiraWorklogEntry;
import com.nexuspm.jira.dto.JiraWorklogResponse;
import com.nexuspm.project.ProjectService;
import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JiraWorklogService {

    private final DfnPmProperties properties;
    private final JiraClient jiraClient;
    private final RdIssueRepository issueRepository;
    private final ProjectService projectService;

    @Transactional(readOnly = true)
    public JiraWorklogResponse getWorklogsForIssue(UUID issueId) {
        ensureJiraConfigured();

        RdIssue issue = issueRepository.findDetailedById(issueId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue not found", 404));
        if (issue.isDeleted()) {
            throw new BusinessException("NOT_FOUND", "Issue not found", 404);
        }
        projectService.getProject(issue.getProject().getId());

        String jiraKey = issue.getJiraId();
        if (jiraKey == null || jiraKey.isBlank()) {
            throw new BusinessException(
                    "JIRA_ID_MISSING",
                    "This item has no JIRA ID. Sync from Jira or set JIRA ID first.",
                    400);
        }

        List<JiraClient.JiraWorklogEntryRaw> raw = jiraClient.getWorklogs(jiraKey.trim());
        JiraClient.JiraTimeTracking tracking = jiraClient.getTimeTracking(jiraKey.trim());
        List<JiraWorklogEntry> entries = new ArrayList<>();
        int totalSeconds = 0;
        for (JiraClient.JiraWorklogEntryRaw item : raw) {
            if (item == null) {
                continue;
            }
            int seconds = item.timeSpentSeconds != null ? item.timeSpentSeconds : 0;
            totalSeconds += seconds;
            String author = item.author != null ? item.author.displayName : null;
            String accountId = item.author != null ? item.author.accountId : null;
            entries.add(JiraWorklogEntry.builder()
                    .id(item.id)
                    .authorDisplayName(author != null && !author.isBlank() ? author : "Unknown")
                    .authorAccountId(accountId)
                    .timeSpent(item.timeSpent)
                    .timeSpentSeconds(item.timeSpentSeconds)
                    .started(parseJiraInstant(item.started))
                    .created(parseJiraInstant(item.created))
                    .updated(parseJiraInstant(item.updated))
                    .comment(extractPlainText(item.comment))
                    .build());
        }

        entries.sort(Comparator.comparing(
                (JiraWorklogEntry e) -> e.getStarted() != null ? e.getStarted() : Instant.EPOCH)
                .reversed());

        int spentSeconds = tracking.timeSpentSeconds() != null ? tracking.timeSpentSeconds() : totalSeconds;
        Integer originalSeconds = tracking.originalEstimateSeconds();
        Integer remainingSeconds = tracking.remainingEstimateSeconds();
        if (remainingSeconds == null && originalSeconds != null) {
            remainingSeconds = Math.max(0, originalSeconds - spentSeconds);
        }

        return JiraWorklogResponse.builder()
                .jiraIssueKey(jiraKey.trim())
                .total(entries.size())
                .totalTimeSpentSeconds(spentSeconds)
                .originalEstimate(tracking.originalEstimate())
                .originalEstimateSeconds(originalSeconds)
                .remainingEstimate(tracking.remainingEstimate() != null
                        ? tracking.remainingEstimate()
                        : (remainingSeconds != null ? formatDuration(remainingSeconds) : null))
                .remainingEstimateSeconds(remainingSeconds)
                .timeSpent(tracking.timeSpent() != null ? tracking.timeSpent() : formatDuration(spentSeconds))
                .timeSpentSeconds(spentSeconds)
                .worklogs(entries)
                .build();
    }

    private static String formatDuration(int seconds) {
        if (seconds <= 0) {
            return "0m";
        }
        int h = seconds / 3600;
        int m = (seconds % 3600) / 60;
        if (h > 0 && m > 0) {
            return h + "h " + m + "m";
        }
        if (h > 0) {
            return h + "h";
        }
        return m + "m";
    }

    private void ensureJiraConfigured() {
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
    }

    private static final DateTimeFormatter JIRA_OFFSET_DATE_TIME = new DateTimeFormatterBuilder()
            .appendPattern("yyyy-MM-dd'T'HH:mm:ss")
            .optionalStart()
            .appendFraction(ChronoField.MILLI_OF_SECOND, 1, 3, true)
            .optionalEnd()
            .appendOffset("+HHmm", "Z")
            .toFormatter();

    private static Instant parseJiraInstant(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        try {
            return OffsetDateTime.parse(trimmed, JIRA_OFFSET_DATE_TIME).toInstant();
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        try {
            // ISO with colon offset: +00:00
            return OffsetDateTime.parse(trimmed).toInstant();
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        try {
            return Instant.parse(trimmed);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String extractPlainText(JsonNode description) {
        if (description == null || description.isNull()) {
            return null;
        }
        if (description.isTextual()) {
            String text = description.asText();
            return text == null || text.isBlank() ? null : text.trim();
        }
        StringBuilder sb = new StringBuilder();
        collectText(description, sb);
        String text = sb.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private static void collectText(JsonNode node, StringBuilder sb) {
        if (node == null || node.isNull()) {
            return;
        }
        if (node.isTextual()) {
            if (!sb.isEmpty()) {
                sb.append(' ');
            }
            sb.append(node.asText());
            return;
        }
        if (node.has("text") && node.get("text").isTextual()) {
            if (!sb.isEmpty()) {
                sb.append(' ');
            }
            sb.append(node.get("text").asText());
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                collectText(child, sb);
            }
            return;
        }
        if (node.isObject() && node.has("content")) {
            collectText(node.get("content"), sb);
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
