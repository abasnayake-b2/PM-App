package com.nexuspm.report.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrgWorkforceSummary {
    private long employeeCount;
    private long cxoCount;
    private long engineeringCount;
    private long deliveryCount;
    private long coeCount;
    private long vpCount;
    private long engineeringManagerCount;
    private long deliveryManagerCount;
    private long coeManagerCount;
    private long projectCount;
    private List<EmOrgEngineerItem> employees;
    private List<EmOrgEngineerItem> cxos;
    private List<EmOrgEngineerItem> engineering;
    private List<EmOrgEngineerItem> delivery;
    private List<EmOrgEngineerItem> coe;
    private List<EmOrgEngineerItem> vps;
    private List<EmOrgEngineerItem> engineeringManagers;
    private List<EmOrgEngineerItem> deliveryManagers;
    private List<EmOrgEngineerItem> coeManagers;
    private List<OrgBreakdownProjectItem> projects;
}
