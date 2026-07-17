package com.nexuspm.organisation.repository;

import com.nexuspm.organisation.entity.Country;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CountryRepository extends JpaRepository<Country, UUID> {

    List<Country> findByRegionIdOrderByNameAsc(UUID regionId);

    List<Country> findByRegionIdAndDeletedFalseOrderByNameAsc(UUID regionId);

    List<Country> findAllByDeletedFalseOrderByNameAsc();

    Optional<Country> findByIdAndDeletedFalse(UUID id);

    long countByRegionId(UUID regionId);

    Optional<Country> findByRegionIdAndNameIgnoreCase(UUID regionId, String name);

    Optional<Country> findFirstByDeletedFalseAndCodeIgnoreCase(String code);

    Optional<Country> findFirstByDeletedFalseAndNameIgnoreCase(String name);
}
