package com.nexuspm.report.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OrgWorkforceSummary {
    private long employeeCount;
    private long cxoCount;
    private long vpCount;
    private long engineeringManagerCount;
    private long projectCount;
}
