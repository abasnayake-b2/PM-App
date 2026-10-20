package com.nexuspm.lookup.repository;

import com.nexuspm.lookup.entity.WorkCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkCategoryRepository extends JpaRepository<WorkCategory, UUID> {

    Optional<WorkCategory> findByNameIgnoreCase(String name);

    List<WorkCategory> findAllByOrderBySortOrderAscNameAsc();

    boolean existsByFunctionalUnitCategory_Id(UUID functionalUnitCategoryId);
}
