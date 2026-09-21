package com.nexuspm.project.repository;

import com.nexuspm.project.entity.ProjectTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectTaskRepository extends JpaRepository<ProjectTask, UUID> {

    @Query("""
            SELECT t FROM ProjectTask t
            JOIN FETCH t.project p
            WHERE p.id = :projectId AND t.deleted = false
            ORDER BY t.taskNumber ASC
            """)
    List<ProjectTask> findActiveByProjectId(UUID projectId);

    @Query("""
            SELECT t FROM ProjectTask t
            JOIN FETCH t.project p
            WHERE t.id = :id AND t.deleted = false
            """)
    Optional<ProjectTask> findActiveDetailedById(UUID id);

    @Query("""
            SELECT COALESCE(MAX(t.taskNumber), 0) FROM ProjectTask t
            WHERE t.project.id = :projectId
            """)
    int findMaxTaskNumber(UUID projectId);
}
