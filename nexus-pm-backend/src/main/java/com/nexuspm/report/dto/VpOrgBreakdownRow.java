package com.nexuspm.report.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class VpOrgBreakdownRow {
    private UUID vpId;
    private String vpName;
    private long engineeringManagerCount;
    private long engineerCount;
    private long projectCount;
    private List<EmOrgEngineerItem> engineeringManagers;
    private List<EmOrgEngineerItem> engineers;
    private List<OrgBreakdownProjectItem> projects;
}
