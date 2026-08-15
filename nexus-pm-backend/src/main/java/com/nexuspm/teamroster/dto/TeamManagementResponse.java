package com.nexuspm.teamroster.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class TeamManagementResponse {
    private UUID id;
    private String roleTitle;
    private String firstName;
    private String lastName;
    private String fullName;
    private String supervisorName;
    private UUID supervisorId;
    private String supervisorFullName;
    /** Relative API path when a picture is stored, e.g. /team-roster/management/{id}/photo */
    private String profilePictureUrl;
    private String status;
    private String employmentType;
    private Instant createdAt;
    private Instant updatedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private String createdByName;
    private String updatedByName;
}
