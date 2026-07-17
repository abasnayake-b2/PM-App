package com.nexuspm.user.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class TeamSearchResponse {

    /** EMPLOYEE, MANAGER, or VP */
    private String searchBy;

    /** Matched VP or manager name, when applicable */
    private String matchedLeaderName;

    /** Flat results for employee or manager search */
    private List<EmployeeResponse> employees;

    /** Grouped results for VP search */
    private List<TeamManagerGroup> groups;
}
