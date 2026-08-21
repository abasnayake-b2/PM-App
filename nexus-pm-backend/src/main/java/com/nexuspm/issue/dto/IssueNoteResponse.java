package com.nexuspm.issue.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class IssueNoteResponse {
    private UUID id;
    private UUID issueId;
    private LocalDate date;
    private String note;
    private String owner;
    private Instant createdAt;
    private Instant updatedAt;
}
