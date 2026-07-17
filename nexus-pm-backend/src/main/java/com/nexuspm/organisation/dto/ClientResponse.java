package com.nexuspm.organisation.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class ClientResponse {

    private UUID id;
    private UUID countryId;
    private String countryName;
    private UUID regionId;
    private String regionName;
    private String name;
    private String status;
    private boolean deleted;
}
