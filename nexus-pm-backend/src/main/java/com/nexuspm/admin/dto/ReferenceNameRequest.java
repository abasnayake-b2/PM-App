package com.nexuspm.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReferenceNameRequest {

    @NotBlank
    private String name;
}
