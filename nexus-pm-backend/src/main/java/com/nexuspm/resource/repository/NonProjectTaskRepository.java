package com.nexuspm.resource.repository;

import com.nexuspm.resource.entity.NonProjectTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface NonProjectTaskRepository extends JpaRepository<NonProjectTask, UUID> {
}
