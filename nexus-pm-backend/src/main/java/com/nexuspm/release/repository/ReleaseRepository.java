package com.nexuspm.release.repository;

import com.nexuspm.release.entity.Release;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ReleaseRepository extends JpaRepository<Release, UUID> {

    @Query("""
            SELECT r FROM Release r
            JOIN FETCH r.project p
            WHERE (:projectId IS NULL OR p.id = :projectId)
            ORDER BY r.targetDate DESC, r.name ASC
            """)
    List<Release> findByProject(UUID projectId);

    @Query("""
            SELECT r FROM Release r
            JOIN FETCH r.project p
            WHERE p.id IN :projectIds
            ORDER BY r.targetDate DESC, r.name ASC
            """)
    List<Release> findByProjectIds(@Param("projectIds") Collection<UUID> projectIds);

    @Query("SELECT r FROM Release r JOIN FETCH r.project WHERE r.id = :id")
    java.util.Optional<Release> findWithProjectById(UUID id);
}
