package com.nexuspm.teamroster.repository;

import com.nexuspm.teamroster.entity.TeamImportBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TeamImportBatchRepository extends JpaRepository<TeamImportBatch, UUID> {

    Optional<TeamImportBatch> findTopByManagementCountGreaterThanOrderByCreatedAtDesc(int managementCount);

    Optional<TeamImportBatch> findTopByMemberCountGreaterThanOrderByCreatedAtDesc(int memberCount);
}
