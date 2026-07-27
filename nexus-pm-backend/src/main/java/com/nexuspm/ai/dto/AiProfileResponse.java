package com.nexuspm.ai.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AiProfileResponse {
    private String key;
    private String label;
    private String model;
    /** Host only — never expose API key. */
    private String baseUrlHost;
}
