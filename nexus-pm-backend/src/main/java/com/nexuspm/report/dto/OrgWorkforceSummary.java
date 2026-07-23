package com.nexuspm.report.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrgWorkforceSummary {
    private long employeeCount;
    private long cxoCount;
    private long vpCount;
    private long engineeringManagerCount;
    private long projectCount;
    private List<EmOrgEngineerItem> employees;
    private List<EmOrgEngineerItem> cxos;
    private List<EmOrgEngineerItem> vps;
    private List<EmOrgEngineerItem> engineeringManagers;
    private List<OrgBreakdownProjectItem> projects;
}
