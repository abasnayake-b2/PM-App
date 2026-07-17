package com.nexuspm.teamroster.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TeamRosterMemberResponse {
    private UUID id;
    private String fullName;
    private UUID designationId;
    private String designationCode;
    private String designation;
    private UUID streamId;
    private String teamName;
    private UUID engineeringManagerManagementId;
    private String engineeringManagerName;
    private UUID workTypeId;
    private String workType;
    private UUID countryId;
    private String country;
    private String product;
    private String email;
    private String phone;
    /** Relative API path when a picture is stored, e.g. /team-roster/members/{id}/photo */
    private String profilePictureUrl;
    private String status;
    private List<UUID> skillIds;
    private List<String> skillNames;
    private BigDecimal totalYearsOfExperience;
    private BigDecimal experienceInDfn;
    private Instant createdAt;
    private Instant updatedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private String createdByName;
    private String updatedByName;
}
