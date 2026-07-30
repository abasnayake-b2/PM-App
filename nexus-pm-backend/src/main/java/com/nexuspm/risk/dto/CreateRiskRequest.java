package com.nexuspm.risk.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateRiskRequest {

    @Size(max = 4000)
    private String description;

    private LocalDate createdDate;

    @Size(max = 120)
    private String owner;

    @Size(max = 40)
    private String status;

    @Size(max = 40)
    private String impact;

    private LocalDate closedDate;

    @Size(max = 4000)
    private String mitigation;
}
