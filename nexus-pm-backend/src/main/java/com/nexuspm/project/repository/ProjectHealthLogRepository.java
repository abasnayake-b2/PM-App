package com.nexuspm.project.repository;

import com.nexuspm.project.entity.ProjectHealthLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ProjectHealthLogRepository extends JpaRepository<ProjectHealthLog, UUID> {

    List<ProjectHealthLog> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    @Query("""
            SELECT phl FROM ProjectHealthLog phl
            JOIN FETCH phl.project p
            LEFT JOIN FETCH phl.changedBy
            WHERE (
                :admin = TRUE
                OR p.leadEmployee.id = :employeeId
                OR EXISTS (
                    SELECT 1 FROM ProjectAccess pa
                    WHERE pa.project = p AND pa.employee.id = :employeeId
                )
            )
            ORDER BY phl.createdAt DESC
            """)
    List<ProjectHealthLog> findRecentAccessible(UUID employeeId, boolean admin, Pageable pageable);

    @Modifying
    @Query("UPDATE ProjectHealthLog phl SET phl.changedBy = NULL WHERE phl.changedBy.id IN :employeeIds")
    void clearChangedByEmployeeIds(@Param("employeeIds") List<UUID> employeeIds);
}
