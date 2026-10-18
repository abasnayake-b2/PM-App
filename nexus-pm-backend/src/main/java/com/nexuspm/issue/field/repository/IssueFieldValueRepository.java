package com.nexuspm.issue.field.repository;

import com.nexuspm.issue.field.entity.IssueFieldValue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IssueFieldValueRepository extends JpaRepository<IssueFieldValue, UUID> {

    @Query("SELECT v FROM IssueFieldValue v JOIN FETCH v.fieldDefinition WHERE v.issue.id = :issueId")
    List<IssueFieldValue> findByIssueId(@Param("issueId") UUID issueId);

    @Query("""
            SELECT v FROM IssueFieldValue v
            JOIN FETCH v.fieldDefinition
            JOIN FETCH v.issue
            WHERE v.issue.id IN :issueIds
            """)
    List<IssueFieldValue> findByIssue_IdIn(@Param("issueIds") Collection<UUID> issueIds);

    void deleteByIssue_Id(UUID issueId);

    Optional<IssueFieldValue> findByIssue_IdAndFieldDefinition_Id(UUID issueId, UUID fieldDefinitionId);

    @Query("""
            SELECT i.project.id, i.status.sequence, SUM(v.valueNumber)
            FROM IssueFieldValue v
            JOIN v.issue i
            JOIN v.fieldDefinition d
            WHERE d.fieldKey = :fieldKey
              AND i.deleted = false
              AND i.parentIssue IS NULL
              AND i.status.sequence BETWEEN 1 AND 17
              AND (:scopedProjectIds IS NULL OR i.project.id IN :scopedProjectIds)
            GROUP BY i.project.id, i.status.sequence
            """)
    List<Object[]> sumNumberByProjectAndStatus(
            @Param("fieldKey") String fieldKey,
            @Param("scopedProjectIds") Collection<UUID> scopedProjectIds);

    @Query("""
            SELECT i.id, v.valueNumber
            FROM IssueFieldValue v
            JOIN v.issue i
            JOIN v.fieldDefinition d
            WHERE d.fieldKey = :fieldKey
              AND i.deleted = false
              AND i.parentIssue IS NULL
              AND i.status.sequence BETWEEN 1 AND 17
              AND (:scopedProjectIds IS NULL OR i.project.id IN :scopedProjectIds)
            """)
    List<Object[]> listNumberByIssue(
            @Param("fieldKey") String fieldKey,
            @Param("scopedProjectIds") Collection<UUID> scopedProjectIds);

    boolean existsByFieldDefinition_Id(UUID fieldDefinitionId);

    void deleteByFieldDefinition_Id(UUID fieldDefinitionId);
}
