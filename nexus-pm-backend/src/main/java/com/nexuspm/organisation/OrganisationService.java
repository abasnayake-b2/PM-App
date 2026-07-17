package com.nexuspm.organisation;

import com.nexuspm.organisation.dto.*;
import com.nexuspm.organisation.entity.Client;
import com.nexuspm.organisation.entity.Country;
import com.nexuspm.organisation.entity.Region;
import com.nexuspm.organisation.mapper.OrganisationMapper;
import com.nexuspm.organisation.repository.ClientRepository;
import com.nexuspm.organisation.repository.CountryRepository;
import com.nexuspm.organisation.repository.RegionRepository;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.shared.softdelete.SoftDeleteService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrganisationService {

    private final RegionRepository regionRepository;
    private final CountryRepository countryRepository;
    private final ClientRepository clientRepository;
    private final OrganisationMapper mapper;
    private final AuditLogService auditLogService;
    private final SoftDeleteService softDeleteService;

    @Transactional(readOnly = true)
    public List<RegionResponse> listRegions(boolean includeDeleted) {
        List<Region> regions = showDeleted(includeDeleted)
                ? regionRepository.findAllByOrderByNameAsc()
                : regionRepository.findAllByDeletedFalseOrderByNameAsc();
        return regions.stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public RegionResponse createRegion(CreateRegionRequest request) {
        if (regionRepository.existsByCode(request.getCode().toUpperCase())) {
            throw new BusinessException("DUPLICATE_CODE", "Region code already exists", 400);
        }
        Region region = new Region();
        region.setId(UUID.randomUUID());
        region.setName(request.getName());
        region.setCode(request.getCode().toUpperCase());
        regionRepository.save(region);
        auditLogService.log(SecurityUtils.currentUserId(), "CREATE", "REGION", region.getId(), region.getName(), null);
        return mapper.toResponse(region);
    }

    @Transactional(readOnly = true)
    public RegionResponse getRegion(UUID id) {
        Region region = regionRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Region not found", 404));
        if (region.isDeleted() && !SecurityUtils.isSuperAdmin()) {
            throw new BusinessException("NOT_FOUND", "Region not found", 404);
        }
        return mapper.toResponse(region);
    }

    @Transactional
    public RegionResponse updateRegion(UUID id, CreateRegionRequest request) {
        Region region = regionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Region not found", 404));
        String code = request.getCode().toUpperCase();
        if (regionRepository.existsByCodeAndIdNot(code, id)) {
            throw new BusinessException("DUPLICATE_CODE", "Region code already exists", 400);
        }
        region.setName(request.getName().trim());
        region.setCode(code);
        regionRepository.save(region);
        auditLogService.log(SecurityUtils.currentUserId(), "UPDATE", "REGION", region.getId(), region.getName(), null);
        return mapper.toResponse(region);
    }

    @Transactional
    public void deleteRegion(UUID id) {
        softDeleteService.softDeleteRegion(id);
    }

    @Transactional
    public RegionResponse restoreRegion(UUID id) {
        softDeleteService.restoreRegion(id);
        return getRegion(id);
    }

    @Transactional(readOnly = true)
    public List<CountryResponse> listCountries(UUID regionId, boolean includeDeleted) {
        List<Country> countries;
        if (regionId != null) {
            countries = showDeleted(includeDeleted)
                    ? countryRepository.findByRegionIdOrderByNameAsc(regionId)
                    : countryRepository.findByRegionIdAndDeletedFalseOrderByNameAsc(regionId);
        } else {
            countries = showDeleted(includeDeleted)
                    ? countryRepository.findAll()
                    : countryRepository.findAllByDeletedFalseOrderByNameAsc();
        }
        return countries.stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public CountryResponse createCountry(CreateCountryRequest request) {
        Region region = regionRepository.findByIdAndDeletedFalse(request.getRegionId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Region not found", 404));
        Country country = new Country();
        country.setId(UUID.randomUUID());
        country.setRegion(region);
        country.setName(request.getName());
        country.setCode(request.getCode().toUpperCase());
        countryRepository.save(country);
        auditLogService.log(SecurityUtils.currentUserId(), "CREATE", "COUNTRY", country.getId(), country.getName(), null);
        return mapper.toResponse(country);
    }

    @Transactional(readOnly = true)
    public CountryResponse getCountry(UUID id) {
        Country country = countryRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Country not found", 404));
        if (country.isDeleted() && !SecurityUtils.isSuperAdmin()) {
            throw new BusinessException("NOT_FOUND", "Country not found", 404);
        }
        return mapper.toResponse(country);
    }

    @Transactional
    public CountryResponse updateCountry(UUID id, CreateCountryRequest request) {
        Country country = countryRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Country not found", 404));
        if (request.getRegionId() != null) {
            Region region = regionRepository.findByIdAndDeletedFalse(request.getRegionId())
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Region not found", 404));
            country.setRegion(region);
        }
        country.setName(request.getName().trim());
        country.setCode(request.getCode().toUpperCase());
        countryRepository.save(country);
        auditLogService.log(SecurityUtils.currentUserId(), "UPDATE", "COUNTRY", country.getId(), country.getName(), null);
        return mapper.toResponse(country);
    }

    @Transactional
    public void deleteCountry(UUID id) {
        softDeleteService.softDeleteCountry(id);
    }

    @Transactional
    public CountryResponse restoreCountry(UUID id) {
        softDeleteService.restoreCountry(id);
        return getCountry(id);
    }

    @Transactional(readOnly = true)
    public List<ClientResponse> listClients(UUID countryId, String status, boolean includeDeleted) {
        List<Client> clients;
        if (countryId != null) {
            clients = showDeleted(includeDeleted)
                    ? clientRepository.findByCountryIdOrderByNameAsc(countryId)
                    : clientRepository.findByCountryIdAndDeletedFalseOrderByNameAsc(countryId);
        } else if (status != null) {
            clients = clientRepository.findByStatusOrderByNameAsc(status).stream()
                    .filter(client -> showDeleted(includeDeleted) || !client.isDeleted())
                    .toList();
        } else {
            clients = showDeleted(includeDeleted)
                    ? clientRepository.findAll()
                    : clientRepository.findAllByDeletedFalseOrderByNameAsc();
        }
        return clients.stream().map(mapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ClientResponse getClient(UUID id) {
        Client client = clientRepository.findDetailedById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Client not found", 404));
        if (client.isDeleted() && !SecurityUtils.isSuperAdmin()) {
            throw new BusinessException("NOT_FOUND", "Client not found", 404);
        }
        return mapper.toResponse(client);
    }

    @Transactional
    public ClientResponse createClient(CreateClientRequest request) {
        Country country = countryRepository.findByIdAndDeletedFalse(request.getCountryId())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Country not found", 404));
        Client client = new Client();
        client.setId(UUID.randomUUID());
        client.setCountry(country);
        client.setName(request.getName());
        client.setStatus("ACTIVE");
        clientRepository.save(client);
        auditLogService.log(SecurityUtils.currentUserId(), "CREATE", "CLIENT", client.getId(), client.getName(), null);
        return mapper.toResponse(client);
    }

    @Transactional
    public ClientResponse updateClient(UUID id, CreateClientRequest request) {
        Client client = clientRepository.findDetailedById(id)
                .filter(c -> !c.isDeleted())
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Client not found", 404));
        if (request.getCountryId() != null) {
            Country country = countryRepository.findByIdAndDeletedFalse(request.getCountryId())
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Country not found", 404));
            client.setCountry(country);
        }
        client.setName(request.getName());
        clientRepository.save(client);
        auditLogService.log(SecurityUtils.currentUserId(), "UPDATE", "CLIENT", client.getId(), client.getName(), null);
        return mapper.toResponse(client);
    }

    @Transactional
    public void deleteClient(UUID id) {
        softDeleteService.softDeleteClient(id);
    }

    @Transactional
    public ClientResponse restoreClient(UUID id) {
        softDeleteService.restoreClient(id);
        return getClient(id);
    }

    private boolean showDeleted(boolean includeDeleted) {
        return includeDeleted && SecurityUtils.isSuperAdmin();
    }
}
