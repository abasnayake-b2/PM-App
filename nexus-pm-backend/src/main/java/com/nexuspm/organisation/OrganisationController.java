package com.nexuspm.organisation;

import com.nexuspm.organisation.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class OrganisationController {

    private final OrganisationService organisationService;

    @GetMapping("/regions")
    @PreAuthorize("@perm.can('ORGANISATIONS_VIEW')")
    public List<RegionResponse> listRegions(
            @RequestParam(defaultValue = "false") boolean includeDeleted) {
        return organisationService.listRegions(includeDeleted);
    }

    @GetMapping("/regions/{id}")
    @PreAuthorize("@perm.can('ORGANISATIONS_VIEW')")
    public RegionResponse getRegion(@PathVariable UUID id) {
        return organisationService.getRegion(id);
    }

    @PostMapping("/regions")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('ORGANISATIONS_CREATE')")
    public RegionResponse createRegion(@Valid @RequestBody CreateRegionRequest request) {
        return organisationService.createRegion(request);
    }

    @PutMapping("/regions/{id}")
    @PreAuthorize("@perm.can('ORGANISATIONS_UPDATE')")
    public RegionResponse updateRegion(@PathVariable UUID id, @Valid @RequestBody CreateRegionRequest request) {
        return organisationService.updateRegion(id, request);
    }

    @DeleteMapping("/regions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('ORGANISATIONS_DELETE')")
    public void deleteRegion(@PathVariable UUID id) {
        organisationService.deleteRegion(id);
    }

    @PatchMapping("/regions/{id}/restore")
    @PreAuthorize("@perm.superAdmin()")
    public RegionResponse restoreRegion(@PathVariable UUID id) {
        return organisationService.restoreRegion(id);
    }

    @GetMapping("/countries")
    @PreAuthorize("@perm.can('ORGANISATIONS_VIEW')")
    public List<CountryResponse> listCountries(
            @RequestParam(required = false) UUID regionId,
            @RequestParam(defaultValue = "false") boolean includeDeleted) {
        return organisationService.listCountries(regionId, includeDeleted);
    }

    @GetMapping("/countries/{id}")
    @PreAuthorize("@perm.can('ORGANISATIONS_VIEW')")
    public CountryResponse getCountry(@PathVariable UUID id) {
        return organisationService.getCountry(id);
    }

    @PostMapping("/countries")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('ORGANISATIONS_CREATE')")
    public CountryResponse createCountry(@Valid @RequestBody CreateCountryRequest request) {
        return organisationService.createCountry(request);
    }

    @PutMapping("/countries/{id}")
    @PreAuthorize("@perm.can('ORGANISATIONS_UPDATE')")
    public CountryResponse updateCountry(@PathVariable UUID id, @Valid @RequestBody CreateCountryRequest request) {
        return organisationService.updateCountry(id, request);
    }

    @DeleteMapping("/countries/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('ORGANISATIONS_DELETE')")
    public void deleteCountry(@PathVariable UUID id) {
        organisationService.deleteCountry(id);
    }

    @PatchMapping("/countries/{id}/restore")
    @PreAuthorize("@perm.superAdmin()")
    public CountryResponse restoreCountry(@PathVariable UUID id) {
        return organisationService.restoreCountry(id);
    }

    @GetMapping("/clients")
    @PreAuthorize("@perm.can('ORGANISATIONS_VIEW')")
    public List<ClientResponse> listClients(
            @RequestParam(required = false) UUID countryId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "false") boolean includeDeleted) {
        return organisationService.listClients(countryId, status, includeDeleted);
    }

    @GetMapping("/clients/{id}")
    @PreAuthorize("@perm.can('ORGANISATIONS_VIEW')")
    public ClientResponse getClient(@PathVariable UUID id) {
        return organisationService.getClient(id);
    }

    @PostMapping("/clients")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('ORGANISATIONS_CREATE')")
    public ClientResponse createClient(@Valid @RequestBody CreateClientRequest request) {
        return organisationService.createClient(request);
    }

    @PutMapping("/clients/{id}")
    @PreAuthorize("@perm.can('ORGANISATIONS_UPDATE')")
    public ClientResponse updateClient(@PathVariable UUID id, @Valid @RequestBody CreateClientRequest request) {
        return organisationService.updateClient(id, request);
    }

    @DeleteMapping("/clients/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('ORGANISATIONS_DELETE')")
    public void deleteClient(@PathVariable UUID id) {
        organisationService.deleteClient(id);
    }

    @PatchMapping("/clients/{id}/restore")
    @PreAuthorize("@perm.superAdmin()")
    public ClientResponse restoreClient(@PathVariable UUID id) {
        return organisationService.restoreClient(id);
    }
}
