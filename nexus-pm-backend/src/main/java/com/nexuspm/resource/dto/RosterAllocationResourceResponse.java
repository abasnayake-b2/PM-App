package com.nexuspm.resource.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class RosterAllocationResourceResponse {

    private UUID employeeId;
    private String fullName;
    private String designationName;
    private String teamName;
    private String engineeringManagerName;
}
