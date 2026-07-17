package com.nexuspm.organisation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateClientRequest {

    @NotNull
    private UUID countryId;

    @NotBlank
    private String name;
}
