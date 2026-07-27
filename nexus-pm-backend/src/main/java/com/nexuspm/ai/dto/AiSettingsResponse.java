package com.nexuspm.ai.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class AiSettingsResponse {
    private boolean yamlEnabled;
    private boolean softEnabled;
    private boolean available;
    private String modelProfile;
    private String systemInstructions;
    private int maxToolsPerQuestion;
    private int rateLimitPerHour;
    private String allowedRoles;
    private List<AiProfileResponse> profiles;
    private AiProfileResponse activeProfile;
}
