package com.nexuspm.lookup.repository;

import com.nexuspm.lookup.entity.TaskCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskCategoryRepository extends JpaRepository<TaskCategory, UUID> {

    Optional<TaskCategory> findByNameIgnoreCase(String name);

    List<TaskCategory> findAllByOrderBySortOrderAscNameAsc();
}
