package com.nexuspm.release.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
public class CreateReleaseRequest {

    @NotNull
    private UUID projectId;

    @NotBlank
    private String name;

    private String version;
    private String status;
    private LocalDate targetDate;
}
