package com.nexuspm.project;

import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.project.entity.Project;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProjectProgressService {

    public static final String BASIS_ISSUES = "ISSUES";
    public static final String BASIS_SCHEDULE = "SCHEDULE";
    public static final String BASIS_NONE = "NONE";

    private final RdIssueRepository issueRepository;

    public record ProgressResult(int percent, String basis) {}

    public ProgressResult calculate(UUID projectId, LocalDate startDate, LocalDate endDate) {
        long total = issueRepository.countByProjectId(projectId);
        long terminal = issueRepository.countTerminalByProjectId(projectId);
        if (total > 0) {
            return new ProgressResult(percent(terminal, total), BASIS_ISSUES);
        }
        if (startDate != null && endDate != null) {
            return new ProgressResult(scheduleProgress(startDate, endDate), BASIS_SCHEDULE);
        }
        return new ProgressResult(0, BASIS_NONE);
    }

    public Map<UUID, ProgressResult> calculateBatch(Collection<Project> projects) {
        if (projects.isEmpty()) {
            return Map.of();
        }
        List<UUID> projectIds = projects.stream().map(Project::getId).toList();
        Map<UUID, long[]> counts = new HashMap<>();
        for (UUID projectId : projectIds) {
            counts.put(projectId, new long[]{0, 0});
        }
        for (Object[] row : issueRepository.countIssueProgressByProjectIds(projectIds)) {
            UUID projectId = (UUID) row[0];
            counts.put(projectId, new long[]{toLong(row[1]), toLong(row[2])});
        }

        Map<UUID, ProgressResult> result = new HashMap<>();
        for (Project project : projects) {
            long[] issueCounts = counts.get(project.getId());
            if (issueCounts[0] > 0) {
                result.put(
                        project.getId(),
                        new ProgressResult(percent(issueCounts[1], issueCounts[0]), BASIS_ISSUES));
            } else if (project.getStartDate() != null && project.getEndDate() != null) {
                result.put(
                        project.getId(),
                        new ProgressResult(scheduleProgress(project.getStartDate(), project.getEndDate()), BASIS_SCHEDULE));
            } else {
                result.put(project.getId(), new ProgressResult(0, BASIS_NONE));
            }
        }
        return result;
    }

    private static int percent(long completed, long total) {
        return (int) Math.round(completed * 100.0 / total);
    }

    private static long toLong(Object value) {
        return value != null ? ((Number) value).longValue() : 0L;
    }

    static int scheduleProgress(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null || !endDate.isAfter(startDate)) {
            return 0;
        }
        LocalDate today = LocalDate.now();
        if (today.isBefore(startDate)) {
            return 0;
        }
        if (!today.isBefore(endDate)) {
            return 100;
        }
        long totalDays = ChronoUnit.DAYS.between(startDate, endDate);
        if (totalDays <= 0) {
            return 0;
        }
        long elapsedDays = ChronoUnit.DAYS.between(startDate, today);
        return (int) Math.min(100, Math.round(elapsedDays * 100.0 / totalDays));
    }
}
