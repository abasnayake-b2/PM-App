package com.nexuspm.teamroster.repository;

import com.nexuspm.teamroster.entity.EmployeeManagerAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface EmployeeManagerAssignmentRepository extends JpaRepository<EmployeeManagerAssignment, UUID> {

    List<EmployeeManagerAssignment> findByEmployee_IdOrderByFromDateAsc(UUID employeeId);

    @Query("""
            SELECT a FROM EmployeeManagerAssignment a
            JOIN FETCH a.employee e
            LEFT JOIN FETCH e.designation
            LEFT JOIN FETCH a.engineeringManager m
            LEFT JOIN FETCH m.supervisor
            WHERE a.fromDate <= :asOf
              AND (a.toDate IS NULL OR a.toDate >= :asOf)
              AND (e.teamManagement IS NULL OR m.id IS NOT NULL)
              AND (:includeInactive = true OR e.status = 'ACTIVE')
              AND (:employeeId IS NULL OR e.id = :employeeId)
              AND (:managerId IS NULL OR m.id = :managerId)
              AND (:search IS NULL OR :search = '' OR
                   LOWER(CONCAT(e.firstName, ' ', e.lastName)) LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY e.firstName, e.lastName
            """)
    List<EmployeeManagerAssignment> findAsOf(
            @Param("asOf") LocalDate asOf,
            @Param("employeeId") UUID employeeId,
            @Param("managerId") UUID managerId,
            @Param("search") String search,
            @Param("includeInactive") boolean includeInactive);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM EmployeeManagerAssignment a WHERE a.employee.id IN :employeeIds")
    void deleteByEmployeeIdIn(@Param("employeeIds") Collection<UUID> employeeIds);
}
