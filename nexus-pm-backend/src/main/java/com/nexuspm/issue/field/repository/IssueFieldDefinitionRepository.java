package com.nexuspm.issue.field.repository;

import com.nexuspm.issue.field.entity.IssueFieldDefinition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IssueFieldDefinitionRepository extends JpaRepository<IssueFieldDefinition, UUID> {

    List<IssueFieldDefinition> findAllByOrderByDisplayOrderAsc();

    List<IssueFieldDefinition> findByActiveTrueOrderByDisplayOrderAsc();

    boolean existsByFieldKeyIgnoreCase(String fieldKey);

    Optional<IssueFieldDefinition> findByFieldKey(String fieldKey);
}
