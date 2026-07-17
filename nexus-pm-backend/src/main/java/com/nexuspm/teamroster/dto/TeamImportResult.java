package com.nexuspm.teamroster.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TeamImportResult {
    private UUID batchId;
    private String fileName;
    private int managementImported;
    private int membersImported;
    private int usersCreated;
    private List<ManagementUserProvisioned> provisionedUsers;
    private String importedByName;
    private Instant importedAt;
}
