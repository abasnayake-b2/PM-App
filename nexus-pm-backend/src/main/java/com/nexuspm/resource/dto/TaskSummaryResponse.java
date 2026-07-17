package com.nexuspm.resource.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class TaskSummaryResponse {

    private UUID id;
    private String title;
    private UUID issueId;
    private String issueTitle;
    private UUID projectId;
    private String projectName;
}
