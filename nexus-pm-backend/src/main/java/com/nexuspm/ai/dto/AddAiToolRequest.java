package com.nexuspm.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AddAiToolRequest {

    @NotBlank
    @Size(max = 100)
    private String toolKey;

    @Size(max = 150)
    private String displayName;

    private String description;
}
