package com.nexuspm.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
public class CreateHolidayRequest {

    @NotBlank
    private String name;

    @NotNull
    private LocalDate holidayDate;

    private UUID countryId;
}
