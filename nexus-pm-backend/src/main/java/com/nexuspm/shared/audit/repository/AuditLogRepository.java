package com.nexuspm.shared.audit.repository;

import com.nexuspm.shared.audit.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("""
            SELECT a FROM AuditLog a
            WHERE (:search IS NULL OR :search = ''
               OR LOWER(a.action) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(a.entityType) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(COALESCE(a.details, '')) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(COALESCE(a.ipAddress, '')) LIKE LOWER(CONCAT('%', :search, '%'))
               OR a.employeeId IN (
                    SELECT e.id FROM Employee e
                    WHERE LOWER(CONCAT(e.firstName, ' ', e.lastName)) LIKE LOWER(CONCAT('%', :search, '%'))
               ))
            """)
    Page<AuditLog> search(@Param("search") String search, Pageable pageable);

    @Modifying
    @Query("UPDATE AuditLog a SET a.employeeId = NULL WHERE a.employeeId IN :employeeIds")
    void clearEmployeeReferences(@Param("employeeIds") List<UUID> employeeIds);
}
