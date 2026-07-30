package com.nexuspm.issue.repository;

import com.nexuspm.issue.entity.RdIssueRisk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RdIssueRiskRepository extends JpaRepository<RdIssueRisk, UUID> {

    @Query("""
            SELECT r FROM RdIssueRisk r
            JOIN FETCH r.issue i
            WHERE i.id = :issueId AND r.deleted = false
            ORDER BY r.riskNumber ASC
            """)
    List<RdIssueRisk> findActiveByIssueId(UUID issueId);

    @Query("""
            SELECT r FROM RdIssueRisk r
            JOIN FETCH r.issue i
            JOIN FETCH i.project
            WHERE r.id = :id AND r.deleted = false
            """)
    Optional<RdIssueRisk> findActiveDetailedById(UUID id);

    @Query("""
            SELECT COALESCE(MAX(r.riskNumber), 0) FROM RdIssueRisk r
            WHERE r.issue.id = :issueId
            """)
    int findMaxRiskNumber(UUID issueId);
}
