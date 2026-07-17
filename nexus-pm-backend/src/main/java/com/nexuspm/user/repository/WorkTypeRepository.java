package com.nexuspm.user.repository;

import com.nexuspm.user.entity.WorkType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WorkTypeRepository extends JpaRepository<WorkType, UUID> {

    Optional<WorkType> findByNameIgnoreCase(String name);
}
