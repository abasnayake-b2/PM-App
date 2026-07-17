package com.nexuspm.report.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class EmOrgBreakdownRow {
    private UUID emId;
    private String emName;
    private long engineerCount;
    private long projectCount;
    private List<EmOrgEngineerItem> engineers;
    private List<OrgBreakdownProjectItem> projects;
}
