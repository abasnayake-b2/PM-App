package com.nexuspm.project.repository;

import com.nexuspm.project.entity.Budget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface BudgetRepository extends JpaRepository<Budget, UUID> {

    Optional<Budget> findByProjectId(UUID projectId);
}
