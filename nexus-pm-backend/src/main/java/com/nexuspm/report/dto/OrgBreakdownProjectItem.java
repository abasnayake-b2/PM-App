package com.nexuspm.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrgBreakdownProjectItem {
    private String name;
    private String regionName;
    private String countryName;
}
