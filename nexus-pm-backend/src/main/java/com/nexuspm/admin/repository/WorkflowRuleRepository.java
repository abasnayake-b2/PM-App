package com.nexuspm.admin.repository;

import com.nexuspm.admin.entity.WorkflowRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface WorkflowRuleRepository extends JpaRepository<WorkflowRule, UUID> {

    @Query("""
            SELECT w FROM WorkflowRule w
            JOIN FETCH w.issueType
            JOIN FETCH w.fromStatus
            JOIN FETCH w.toStatus
            ORDER BY w.issueType.name, w.fromStatus.sequence
            """)
    List<WorkflowRule> findAllDetailed();

    boolean existsByIssueType_Id(UUID issueTypeId);

    boolean existsByIssueType_IdAndFromStatus_IdAndToStatus_Id(
            UUID issueTypeId, UUID fromStatusId, UUID toStatusId);
}
