package com.nexuspm.report.repository;

import com.nexuspm.report.entity.EmCapacityPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EmCapacityPlanRepository extends JpaRepository<EmCapacityPlan, UUID> {

    Optional<EmCapacityPlan> findByEngineeringManager_Id(UUID emManagementId);
}
