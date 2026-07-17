package com.nexuspm.organisation.mapper;

import com.nexuspm.organisation.dto.ClientResponse;
import com.nexuspm.organisation.dto.CountryResponse;
import com.nexuspm.organisation.dto.RegionResponse;
import com.nexuspm.organisation.entity.Client;
import com.nexuspm.organisation.entity.Country;
import com.nexuspm.organisation.entity.Region;
import org.springframework.stereotype.Component;

@Component
public class OrganisationMapper {

    public RegionResponse toResponse(Region region) {
        return RegionResponse.builder()
                .id(region.getId())
                .name(region.getName())
                .code(region.getCode())
                .deleted(region.isDeleted())
                .build();
    }

    public CountryResponse toResponse(Country country) {
        return CountryResponse.builder()
                .id(country.getId())
                .regionId(country.getRegion().getId())
                .regionName(country.getRegion().getName())
                .name(country.getName())
                .code(country.getCode())
                .deleted(country.isDeleted())
                .build();
    }

    public ClientResponse toResponse(Client client) {
        return ClientResponse.builder()
                .id(client.getId())
                .countryId(client.getCountry().getId())
                .countryName(client.getCountry().getName())
                .regionId(client.getCountry().getRegion().getId())
                .regionName(client.getCountry().getRegion().getName())
                .name(client.getName())
                .status(client.getStatus())
                .deleted(client.isDeleted())
                .build();
    }
}
