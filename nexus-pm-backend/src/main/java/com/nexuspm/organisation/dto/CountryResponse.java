package com.nexuspm.organisation.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class CountryResponse {

    private UUID id;
    private UUID regionId;
    private String regionName;
    private String name;
    private String code;
    private boolean deleted;
}
