package com.nexuspm.lookup.repository;

import com.nexuspm.lookup.entity.IssueType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface IssueTypeRepository extends JpaRepository<IssueType, UUID> {
}
