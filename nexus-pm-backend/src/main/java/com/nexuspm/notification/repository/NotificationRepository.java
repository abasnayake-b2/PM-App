package com.nexuspm.notification.repository;

import com.nexuspm.notification.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    List<Notification> findByEmployee_IdOrderByCreatedAtDesc(UUID employeeId);

    long countByEmployee_IdAndReadFlagFalse(UUID employeeId);

    @Modifying
    @Query("UPDATE Notification n SET n.readFlag = true WHERE n.employee.id = :employeeId AND n.readFlag = false")
    int markAllRead(UUID employeeId);

    @Modifying
    @Query("DELETE FROM Notification n WHERE n.employee.id IN :employeeIds")
    void deleteByEmployeeIdIn(@Param("employeeIds") List<UUID> employeeIds);
}
