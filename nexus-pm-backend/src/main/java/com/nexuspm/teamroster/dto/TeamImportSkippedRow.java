package com.nexuspm.teamroster.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TeamImportSkippedRow {
    private int rowNumber;
    private String name;
    private String reason;
}
