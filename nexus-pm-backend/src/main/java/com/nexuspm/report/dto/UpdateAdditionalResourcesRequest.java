package com.nexuspm.report.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateAdditionalResourcesRequest {

    @NotNull
    @Min(0)
    @Max(9999)
    private Integer additionalResources;
}
