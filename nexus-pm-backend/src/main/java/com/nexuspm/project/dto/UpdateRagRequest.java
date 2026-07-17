package com.nexuspm.project.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateRagRequest {

    @NotBlank
    private String ragStatus;

    private String notes;
}
