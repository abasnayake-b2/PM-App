package com.nexuspm.user.repository;

import com.nexuspm.user.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {

    Optional<Role> findByCode(String code);

    @Modifying
    @Query(value = "DELETE FROM role_permission WHERE role_id = :roleId", nativeQuery = true)
    void deletePermissionsByRoleId(@Param("roleId") UUID roleId);

    @Modifying
    @Query(value = "INSERT INTO role_permission (role_id, permission_id) VALUES (:roleId, :permissionId)", nativeQuery = true)
    void insertRolePermission(@Param("roleId") UUID roleId, @Param("permissionId") UUID permissionId);

    @Query(value = """
            SELECT p.code
            FROM permission p
            INNER JOIN role_permission rp ON rp.permission_id = p.id
            WHERE rp.role_id = :roleId
            ORDER BY p.module, p.action
            """, nativeQuery = true)
    List<String> findPermissionCodesByRoleId(@Param("roleId") UUID roleId);

    List<Role> findAllByCodeIn(List<String> codes);

    @Query("""
            SELECT r FROM Role r
            LEFT JOIN FETCH r.orgLevel ol
            LEFT JOIN FETCH ol.reportsToOrgLevel
            WHERE r.code = :code
            """)
    Optional<Role> findByCodeWithOrgLevel(String code);
}
