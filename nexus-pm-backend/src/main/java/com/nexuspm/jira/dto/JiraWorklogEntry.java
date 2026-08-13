package com.nexuspm.jira.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class JiraWorklogEntry {

    private String id;
    private String authorDisplayName;
    private String authorAccountId;
    private String timeSpent;
    private Integer timeSpentSeconds;
    private Instant started;
    private Instant created;
    private Instant updated;
    private String comment;
}
