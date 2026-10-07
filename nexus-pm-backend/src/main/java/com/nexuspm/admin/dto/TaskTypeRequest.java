package com.nexuspm.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TaskTypeRequest {

    @NotBlank
    private String name;

    private String description;
}
