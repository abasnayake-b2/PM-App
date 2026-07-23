package com.nexuspm.issue.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IssueStatusCountsResponse {
    /** statusId → total count across the full (non-paginated) filtered set */
    private Map<UUID, Long> countsByStatusId;
    private long total;
}
