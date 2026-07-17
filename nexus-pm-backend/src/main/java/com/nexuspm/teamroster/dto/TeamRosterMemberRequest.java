package com.nexuspm.teamroster.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class TeamRosterMemberRequest {
    @NotBlank
    private String fullName;
    private UUID designationId;
    private UUID streamId;
    private UUID engineeringManagerManagementId;
    private UUID workTypeId;
    private UUID countryId;
    /** Legacy text fallbacks when IDs are not supplied. */
    private String designationCode;
    private String designation;
    private String teamName;
    private String engineeringManagerName;
    private String workType;
    private String country;
    private String product;
    private String email;
    private String phone;
    private String status;
    private List<UUID> skillIds = new ArrayList<>();
    private BigDecimal totalYearsOfExperience;
    private BigDecimal experienceInDfn;
}
