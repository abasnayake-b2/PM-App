package com.nexuspm.teamroster.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RelinkSupervisorsResult {
    private int totalRecords;
    private int linkedCount;
    private int unresolvedCount;
}
