package com.nexuspm.jira.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class JiraWorklogResponse {

    private String jiraIssueKey;
    private int total;
    private int totalTimeSpentSeconds;

    private String originalEstimate;
    private String remainingEstimate;
    private String timeSpent;
    private Integer originalEstimateSeconds;
    private Integer remainingEstimateSeconds;
    private Integer timeSpentSeconds;

    private List<JiraWorklogEntry> worklogs;
}
