package com.nexuspm.organisation.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateRegionRequest {

    @NotBlank
    private String name;

    @NotBlank
    private String code;
}
