package com.nexuspm.release.repository;

import com.nexuspm.release.entity.ReleaseRisk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReleaseRiskRepository extends JpaRepository<ReleaseRisk, UUID> {

    @Query("""
            SELECT r FROM ReleaseRisk r
            JOIN FETCH r.release rel
            JOIN FETCH rel.project
            WHERE rel.id = :releaseId AND r.deleted = false
            ORDER BY r.riskNumber ASC
            """)
    List<ReleaseRisk> findActiveByReleaseId(UUID releaseId);

    @Query("""
            SELECT r FROM ReleaseRisk r
            JOIN FETCH r.release rel
            JOIN FETCH rel.project
            WHERE r.id = :id AND r.deleted = false
            """)
    Optional<ReleaseRisk> findActiveDetailedById(UUID id);

    @Query("""
            SELECT COALESCE(MAX(r.riskNumber), 0) FROM ReleaseRisk r
            WHERE r.release.id = :releaseId
            """)
    int findMaxRiskNumber(UUID releaseId);
}
