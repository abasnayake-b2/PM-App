package com.nexuspm.jira.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class JiraSyncResult {

    private int fetched;
    private int created;
    private int updated;
    private int skipped;
    private List<String> errors;
    private String syncedByName;
    private Instant syncedAt;
}
