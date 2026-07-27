package com.nexuspm.ai.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateAiToolRequest {

    @Size(max = 150)
    private String displayName;

    private String description;

    @Size(max = 80)
    private String requiredPermission;

    private Integer sortOrder;
}
