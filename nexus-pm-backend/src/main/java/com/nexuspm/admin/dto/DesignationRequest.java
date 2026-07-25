package com.nexuspm.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class DesignationRequest {

    @NotBlank
    private String name;

    private String code;

    @NotNull
    private UUID streamId;

    /** True = Management designation; false = Employee (default). */
    private Boolean management;
}
