package com.nexuspm.project.repository;

import com.nexuspm.project.entity.ProjectRisk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectRiskRepository extends JpaRepository<ProjectRisk, UUID> {

    @Query("""
            SELECT r FROM ProjectRisk r
            JOIN FETCH r.project p
            WHERE p.id = :projectId AND r.deleted = false
            ORDER BY r.riskNumber ASC
            """)
    List<ProjectRisk> findActiveByProjectId(UUID projectId);

    @Query("""
            SELECT r FROM ProjectRisk r
            JOIN FETCH r.project p
            WHERE r.id = :id AND r.deleted = false
            """)
    Optional<ProjectRisk> findActiveDetailedById(UUID id);

    @Query("""
            SELECT COALESCE(MAX(r.riskNumber), 0) FROM ProjectRisk r
            WHERE r.project.id = :projectId
            """)
    int findMaxRiskNumber(UUID projectId);
}
