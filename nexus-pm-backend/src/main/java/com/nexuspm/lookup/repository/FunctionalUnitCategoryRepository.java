package com.nexuspm.lookup.repository;

import com.nexuspm.lookup.entity.FunctionalUnitCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FunctionalUnitCategoryRepository extends JpaRepository<FunctionalUnitCategory, UUID> {

    Optional<FunctionalUnitCategory> findByNameIgnoreCase(String name);

    List<FunctionalUnitCategory> findAllByOrderBySortOrderAscNameAsc();
}
