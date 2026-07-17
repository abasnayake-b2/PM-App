package com.nexuspm.issue.field.repository;

import com.nexuspm.issue.field.entity.IssueFieldValue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IssueFieldValueRepository extends JpaRepository<IssueFieldValue, UUID> {

    @Query("SELECT v FROM IssueFieldValue v JOIN FETCH v.fieldDefinition WHERE v.issue.id = :issueId")
    List<IssueFieldValue> findByIssueId(@Param("issueId") UUID issueId);

    void deleteByIssue_Id(UUID issueId);

    Optional<IssueFieldValue> findByIssue_IdAndFieldDefinition_Id(UUID issueId, UUID fieldDefinitionId);

    boolean existsByFieldDefinition_Id(UUID fieldDefinitionId);

    void deleteByFieldDefinition_Id(UUID fieldDefinitionId);
}
