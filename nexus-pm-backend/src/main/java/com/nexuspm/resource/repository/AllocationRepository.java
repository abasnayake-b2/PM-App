package com.nexuspm.resource.repository;

import com.nexuspm.resource.entity.Allocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface AllocationRepository extends JpaRepository<Allocation, UUID> {

    @Query("""
            SELECT a FROM Allocation a
            JOIN FETCH a.employee e
            JOIN FETCH a.issue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release r
            WHERE (:projectId IS NULL OR p.id = :projectId)
              AND (:issueId IS NULL OR i.id = :issueId)
              AND (:employeeId IS NULL OR e.id = :employeeId)
              AND a.fromDate <= :asOf
              AND (a.toDate IS NULL OR a.toDate >= :asOf)
              AND a.deleted = false
              AND i.deleted = false
            ORDER BY e.lastName, e.firstName, p.name, i.title
            """)
    List<Allocation> findActive(UUID projectId, UUID issueId, UUID employeeId, LocalDate asOf);

    @Query("""
            SELECT a FROM Allocation a
            JOIN FETCH a.employee e
            JOIN FETCH a.issue i
            WHERE i.id IN :issueIds
              AND a.fromDate <= :asOf
              AND (a.toDate IS NULL OR a.toDate >= :asOf)
              AND a.deleted = false
              AND i.deleted = false
              AND a.deleted = false
            ORDER BY i.id, e.lastName, e.firstName
            """)
    List<Allocation> findActiveByIssueIds(List<UUID> issueIds, LocalDate asOf);

    @Query("""
            SELECT a FROM Allocation a
            JOIN FETCH a.employee e
            LEFT JOIN FETCH e.department
            LEFT JOIN FETCH e.designation
            JOIN FETCH a.issue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release r
            WHERE a.fromDate <= :rangeEnd
              AND (a.toDate IS NULL OR a.toDate >= :rangeStart)
              AND a.deleted = false
              AND i.deleted = false
              AND (:departmentId IS NULL OR e.department.id = :departmentId)
            ORDER BY e.lastName, e.firstName, p.name, i.title
            """)
    List<Allocation> findInRange(LocalDate rangeStart, LocalDate rangeEnd, UUID departmentId);

    @Query("""
            SELECT a FROM Allocation a
            JOIN FETCH a.employee e
            LEFT JOIN FETCH e.department
            LEFT JOIN FETCH e.designation
            JOIN FETCH a.issue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release r
            WHERE a.fromDate <= :rangeEnd
              AND (a.toDate IS NULL OR a.toDate >= :rangeStart)
              AND a.deleted = false
              AND i.deleted = false
              AND p.id IN :projectIds
            ORDER BY e.lastName, e.firstName, p.name, i.title
            """)
    List<Allocation> findInRangeForProjects(
            LocalDate rangeStart, LocalDate rangeEnd, Collection<UUID> projectIds);

    @Query("""
            SELECT a FROM Allocation a
            JOIN FETCH a.employee e
            JOIN FETCH a.issue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release r
            WHERE p.id IN :projectIds
              AND (:issueId IS NULL OR i.id = :issueId)
              AND (:employeeId IS NULL OR e.id = :employeeId)
              AND a.fromDate <= :asOf
              AND (a.toDate IS NULL OR a.toDate >= :asOf)
              AND a.deleted = false
              AND i.deleted = false
            ORDER BY e.lastName, e.firstName, p.name, i.title
            """)
    List<Allocation> findActiveForProjects(
            Collection<UUID> projectIds, UUID issueId, UUID employeeId, LocalDate asOf);

    @Query("""
            SELECT e.id, e.firstName, e.lastName, SUM(a.percentage)
            FROM Allocation a
            JOIN a.employee e
            WHERE a.fromDate <= :asOf
              AND (a.toDate IS NULL OR a.toDate >= :asOf)
            GROUP BY e.id, e.firstName, e.lastName
            ORDER BY e.lastName, e.firstName
            """)
    List<Object[]> sumPercentageByEmployee(LocalDate asOf);

    @Query("""
            SELECT e.id, e.firstName, e.lastName, SUM(a.percentage)
            FROM Allocation a
            JOIN a.employee e
            JOIN a.issue i
            WHERE a.fromDate <= :asOf
              AND (a.toDate IS NULL OR a.toDate >= :asOf)
              AND i.project.id IN :projectIds
            GROUP BY e.id, e.firstName, e.lastName
            ORDER BY e.lastName, e.firstName
            """)
    List<Object[]> sumPercentageByEmployeeForProjects(LocalDate asOf, Collection<UUID> projectIds);

    @Query("""
            SELECT a FROM Allocation a
            JOIN FETCH a.issue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release r
            WHERE a.employee.id = :employeeId
              AND a.fromDate <= :rangeEnd
              AND (a.toDate IS NULL OR a.toDate >= :rangeStart)
            ORDER BY p.name, i.title
            """)
    List<Allocation> findOverlapping(UUID employeeId, LocalDate rangeStart, LocalDate rangeEnd);

    @Query("""
            SELECT a FROM Allocation a
            JOIN FETCH a.employee e
            JOIN FETCH a.issue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release r
            WHERE i.id = :issueId
              AND a.deleted = false
            ORDER BY e.lastName, e.firstName
            """)
    List<Allocation> findByIssue(UUID issueId);

    @Query("""
            SELECT a FROM Allocation a
            JOIN FETCH a.employee e
            JOIN FETCH a.issue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release r
            WHERE p.id = :projectId
            ORDER BY e.lastName, e.firstName, i.title
            """)
    List<Allocation> findByProject(UUID projectId);

    @Query("""
            SELECT a FROM Allocation a
            JOIN FETCH a.employee e
            JOIN FETCH a.issue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release r
            WHERE e.id = :employeeId
            ORDER BY p.name, i.title
            """)
    List<Allocation> findByEmployee(UUID employeeId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("DELETE FROM Allocation a WHERE a.employee.id IN :employeeIds")
    void deleteByEmployeeIdIn(List<UUID> employeeIds);
}
