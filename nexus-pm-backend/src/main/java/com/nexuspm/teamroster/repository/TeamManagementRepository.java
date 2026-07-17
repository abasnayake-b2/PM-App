package com.nexuspm.teamroster.repository;

import com.nexuspm.teamroster.entity.TeamManagement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface TeamManagementRepository extends JpaRepository<TeamManagement, UUID> {

    @Query("""
            SELECT m FROM TeamManagement m
            LEFT JOIN FETCH m.supervisor s
            WHERE (:search IS NULL OR :search = '' OR
                   LOWER(CONCAT(m.firstName, ' ', m.lastName)) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(m.roleTitle) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(CONCAT(COALESCE(s.firstName, ''), ' ', COALESCE(s.lastName, '')))
                       LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY m.roleTitle, m.lastName, m.firstName
            """)
    List<TeamManagement> search(String search);

    @Query("""
            SELECT m FROM TeamManagement m
            LEFT JOIN FETCH m.supervisor
            WHERE m.status = 'ACTIVE'
              AND NOT EXISTS (
                  SELECT 1 FROM Employee e WHERE e.teamManagement.id = m.id)
              AND (:search IS NULL OR :search = '' OR
                   LOWER(CONCAT(m.firstName, ' ', m.lastName)) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(m.roleTitle) LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY m.roleTitle, m.lastName, m.firstName
            """)
    List<TeamManagement> findEligibleForUserAccount(String search);

    @Modifying
    @Query("UPDATE TeamManagement m SET m.supervisor = NULL WHERE m.supervisor.id = :managementId")
    void clearSupervisorReferences(@Param("managementId") UUID managementId);
}
