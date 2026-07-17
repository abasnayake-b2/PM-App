package com.nexuspm.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SkillRequest {

    @NotBlank
    private String name;

    private String description;
}
