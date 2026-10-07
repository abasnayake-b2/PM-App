package com.nexuspm.lookup.repository;

import com.nexuspm.lookup.entity.TaskType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskTypeRepository extends JpaRepository<TaskType, UUID> {

    Optional<TaskType> findByNameIgnoreCase(String name);

    List<TaskType> findAllByOrderBySortOrderAscNameAsc();
}
