package com.nexuspm.organisation.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class RegionResponse {

    private UUID id;
    private String name;
    private String code;
    private boolean deleted;
}
