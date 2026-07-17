package com.nexuspm.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class HolidayResponse {

    private UUID id;
    private String name;
    private LocalDate holidayDate;
    private UUID countryId;
    private String countryName;
}

