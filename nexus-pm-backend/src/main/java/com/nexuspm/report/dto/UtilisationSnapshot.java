package com.nexuspm.report.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class UtilisationSnapshot {
    private UUID employeeId;
    private String employeeName;
    private int totalPct;
    private boolean overAllocated;
}
