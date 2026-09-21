package com.nexuspm.issue.repository;

import com.nexuspm.issue.entity.RdIssueTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RdIssueTaskRepository extends JpaRepository<RdIssueTask, UUID> {

    @Query("""
            SELECT t FROM RdIssueTask t
            JOIN FETCH t.issue i
            WHERE i.id = :issueId AND t.deleted = false
            ORDER BY t.taskNumber ASC
            """)
    List<RdIssueTask> findActiveByIssueId(UUID issueId);

    @Query("""
            SELECT t FROM RdIssueTask t
            JOIN FETCH t.issue i
            JOIN FETCH i.project
            WHERE t.id = :id AND t.deleted = false
            """)
    Optional<RdIssueTask> findActiveDetailedById(UUID id);

    @Query("""
            SELECT COALESCE(MAX(t.taskNumber), 0) FROM RdIssueTask t
            WHERE t.issue.id = :issueId
            """)
    int findMaxTaskNumber(UUID issueId);
}
