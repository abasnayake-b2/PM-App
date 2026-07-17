package com.nexuspm.resource.repository;

import com.nexuspm.resource.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<Task, UUID> {

    @Query("""
            SELECT t FROM Task t
            JOIN FETCH t.issue i
            JOIN FETCH i.project
            LEFT JOIN FETCH i.release
            WHERE t.id = :id
            """)
    Optional<Task> findDetailedById(UUID id);

    @Query("""
            SELECT t FROM Task t
            JOIN FETCH t.issue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release
            WHERE (:projectId IS NULL OR p.id = :projectId)
            ORDER BY p.name, i.title, t.title
            """)
    java.util.List<Task> findByProject(UUID projectId);

    @Modifying
    @Query(value = "UPDATE task SET assigned_to = NULL WHERE assigned_to IN :employeeIds", nativeQuery = true)
    void clearAssigneeByEmployeeIds(@Param("employeeIds") List<UUID> employeeIds);
}
