package com.nexuspm.teamroster.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class ManagementUserProvisioned {
    private UUID managementId;
    private String fullName;
    private String email;
    private String roleCode;
    private String initialPassword;
}
