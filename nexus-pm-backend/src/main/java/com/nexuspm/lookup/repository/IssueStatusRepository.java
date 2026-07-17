package com.nexuspm.lookup.repository;

import com.nexuspm.lookup.entity.IssueStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface IssueStatusRepository extends JpaRepository<IssueStatus, UUID> {

    List<IssueStatus> findAllByOrderBySequenceAsc();

    java.util.Optional<IssueStatus> findByName(String name);
}
