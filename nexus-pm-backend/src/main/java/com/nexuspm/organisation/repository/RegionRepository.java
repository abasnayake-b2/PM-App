package com.nexuspm.organisation.repository;

import com.nexuspm.organisation.entity.Region;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RegionRepository extends JpaRepository<Region, UUID> {

    List<Region> findAllByDeletedFalseOrderByNameAsc();

    List<Region> findAllByOrderByNameAsc();

    Optional<Region> findByIdAndDeletedFalse(UUID id);

    boolean existsByCode(String code);

    boolean existsByCodeAndIdNot(String code, UUID id);

    Optional<Region> findByNameIgnoreCase(String name);
}
