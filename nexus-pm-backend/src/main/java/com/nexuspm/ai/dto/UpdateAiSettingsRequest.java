package com.nexuspm.ai.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateAiSettingsRequest {

    private Boolean softEnabled;

    @Size(max = 80)
    private String modelProfile;

    private String systemInstructions;

    @Min(1)
    @Max(20)
    private Integer maxToolsPerQuestion;

    @Min(0)
    @Max(10_000)
    private Integer rateLimitPerHour;

    /** Comma-separated role codes; empty = no extra role filter. */
    @Size(max = 500)
    private String allowedRoles;
}
