package com.nexuspm.lookup.repository;

import com.nexuspm.lookup.entity.ProjectType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectTypeRepository extends JpaRepository<ProjectType, UUID> {

    Optional<ProjectType> findByNameIgnoreCase(String name);

    List<ProjectType> findAllByOrderBySortOrderAscNameAsc();
}
