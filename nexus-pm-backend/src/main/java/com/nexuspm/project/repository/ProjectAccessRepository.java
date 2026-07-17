package com.nexuspm.project.repository;

import com.nexuspm.project.entity.ProjectAccess;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectAccessRepository extends JpaRepository<ProjectAccess, UUID> {

    List<ProjectAccess> findByProjectId(UUID projectId);

    Optional<ProjectAccess> findByProjectIdAndEmployeeId(UUID projectId, UUID employeeId);

    boolean existsByProjectIdAndEmployeeId(UUID projectId, UUID employeeId);

    @Modifying
    @Query("DELETE FROM ProjectAccess pa WHERE pa.employee.id IN :employeeIds")
    void deleteByEmployeeIdIn(@Param("employeeIds") List<UUID> employeeIds);
}
