package com.nexuspm.resource.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
public class CreateTimeLogRequest {

    @NotNull
    private UUID taskId;

    @NotNull
    private LocalDate logDate;

    @NotNull
    @DecimalMin("0.25")
    @DecimalMax("24.0")
    private BigDecimal hours;

    private String notes;
}
