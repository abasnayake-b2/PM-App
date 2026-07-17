package com.nexuspm.user.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TeamManagerGroup {

    private UUID managerId;
    private String managerName;
    private EmployeeResponse manager;
    private List<EmployeeResponse> members;
}
