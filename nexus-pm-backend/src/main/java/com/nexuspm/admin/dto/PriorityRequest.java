package com.nexuspm.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PriorityRequest {

    @NotBlank
    private String label;

    private int level;
    private int slaResponseHrs;
    private int slaResolveHrs;
    private String colour;
}
