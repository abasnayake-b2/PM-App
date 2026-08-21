package com.nexuspm.issue.repository;

import com.nexuspm.issue.entity.RdIssueQuarterlyCompletion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RdIssueQuarterlyCompletionRepository extends JpaRepository<RdIssueQuarterlyCompletion, UUID> {

    @Query("""
            SELECT c FROM RdIssueQuarterlyCompletion c
            JOIN FETCH c.issue i
            WHERE i.id = :issueId AND c.deleted = false
            ORDER BY c.year ASC, c.quarter ASC
            """)
    List<RdIssueQuarterlyCompletion> findActiveByIssueId(UUID issueId);

    @Query("""
            SELECT c FROM RdIssueQuarterlyCompletion c
            JOIN FETCH c.issue i
            JOIN FETCH i.project
            WHERE c.id = :id AND c.deleted = false
            """)
    Optional<RdIssueQuarterlyCompletion> findActiveDetailedById(UUID id);

    boolean existsByIssue_IdAndYearAndQuarterAndDeletedFalse(UUID issueId, Integer year, Integer quarter);

    boolean existsByIssue_IdAndYearAndQuarterAndDeletedFalseAndIdNot(
            UUID issueId, Integer year, Integer quarter, UUID id);
}
