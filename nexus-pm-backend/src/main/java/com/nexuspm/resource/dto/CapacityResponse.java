package com.nexuspm.resource.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class CapacityResponse {

    private UUID employeeId;
    private String employeeName;
    /** Relative API path when set, e.g. /team-roster/members/{id}/photo */
    private String profilePictureUrl;
    private String departmentName;
    private String designationName;
    private String vpName;
    private String engineeringManagerName;
    private String benchStatus;
    /** Average daily allocation % over the requested from–to range. */
    private int totalPercentage;
    /** max(0, 100 − totalPercentage) for the same date range. */
    private int availablePercentage;
    private boolean overAllocated;
    private List<AllocationResponse> allocations;
    private List<AllocationResponse> periodAllocations;
}
