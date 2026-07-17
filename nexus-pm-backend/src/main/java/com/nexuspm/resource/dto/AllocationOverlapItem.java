package com.nexuspm.resource.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class AllocationOverlapItem {

    private UUID allocationId;
    private UUID issueId;
    private String issueTitle;
    private UUID projectId;
    private String projectName;
    private Integer percentage;
    private LocalDate fromDate;
    private LocalDate toDate;
}
