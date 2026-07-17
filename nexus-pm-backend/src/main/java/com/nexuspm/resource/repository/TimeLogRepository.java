package com.nexuspm.resource.repository;

import com.nexuspm.resource.entity.TimeLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TimeLogRepository extends JpaRepository<TimeLog, UUID> {

    @Query("""
            SELECT t FROM TimeLog t
            JOIN FETCH t.employee e
            JOIN FETCH t.task task
            JOIN FETCH task.issue i
            JOIN FETCH i.release r
            JOIN FETCH r.project
            WHERE (:employeeId IS NULL OR e.id = :employeeId)
              AND (:from IS NULL OR t.logDate >= :from)
              AND (:to IS NULL OR t.logDate <= :to)
            ORDER BY t.logDate DESC, t.createdAt DESC
            """)
    List<TimeLog> search(UUID employeeId, LocalDate from, LocalDate to);

    @Query("""
            SELECT t FROM TimeLog t
            JOIN FETCH t.employee
            JOIN FETCH t.task task
            JOIN FETCH task.issue i
            JOIN FETCH i.release r
            JOIN FETCH r.project
            WHERE t.id = :id
            """)
    Optional<TimeLog> findDetailedById(UUID id);

    @Query("""
            SELECT t.logDate, SUM(t.hours)
            FROM TimeLog t
            WHERE t.employee.id = :employeeId
              AND t.logDate >= :weekStart
              AND t.logDate < :weekEnd
            GROUP BY t.logDate
            ORDER BY t.logDate
            """)
    List<Object[]> sumHoursByDay(UUID employeeId, LocalDate weekStart, LocalDate weekEnd);

    @Modifying
    @Query("DELETE FROM TimeLog t WHERE t.employee.id IN :employeeIds")
    void deleteByEmployeeIdIn(@Param("employeeIds") List<UUID> employeeIds);
}
