package com.nexuspm.organisation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateCountryRequest {

    @NotNull
    private UUID regionId;

    @NotBlank
    private String name;

    @NotBlank
    private String code;
}
