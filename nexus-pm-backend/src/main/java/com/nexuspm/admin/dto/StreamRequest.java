package com.nexuspm.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class StreamRequest {

    @NotBlank
    private String name;

    @NotNull
    private UUID departmentId;
}
