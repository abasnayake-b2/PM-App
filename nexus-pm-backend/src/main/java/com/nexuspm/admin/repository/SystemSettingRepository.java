package com.nexuspm.admin.repository;

import com.nexuspm.admin.entity.SystemSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SystemSettingRepository extends JpaRepository<SystemSetting, UUID> {

    List<SystemSetting> findAllByOrderBySettingKeyAsc();

    Optional<SystemSetting> findBySettingKey(String settingKey);

    @Modifying
    @Query("UPDATE SystemSetting s SET s.updatedBy = NULL WHERE s.updatedBy IN :employeeIds")
    void clearUpdatedByEmployeeIds(@Param("employeeIds") List<UUID> employeeIds);
}
