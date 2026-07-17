package com.nexuspm.auth.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TokenResponse {

    private String accessToken;
    private String tokenType;
    private long expiresIn;
    private UUID userId;
    private String email;
    private String name;
    private String role;
    private UUID departmentId;
    /** True when the password is older than the configured max age (default 90 days). */
    private boolean passwordChangeDue;
    private Integer passwordAgeDays;
    private List<String> permissionCodes;
    /** Manager-only: own team vs org-wide visibility. */
    private boolean orgWideVisibility;
}
