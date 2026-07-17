package com.nexuspm.user.repository;

import com.nexuspm.user.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PermissionRepository extends JpaRepository<Permission, UUID> {

    Optional<Permission> findByCode(String code);

    List<Permission> findAllByOrderByModuleAscActionAsc();

    @Query(value = """
            SELECT DISTINCT p.code
            FROM permission p
            INNER JOIN role_permission rp ON rp.permission_id = p.id
            INNER JOIN employee_role er ON er.role_id = rp.role_id
            WHERE er.employee_id = :employeeId
            """, nativeQuery = true)
    List<String> findPermissionCodesByEmployeeId(UUID employeeId);
}
