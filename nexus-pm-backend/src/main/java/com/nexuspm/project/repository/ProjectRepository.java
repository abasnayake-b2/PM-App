package com.nexuspm.project.repository;

import com.nexuspm.project.entity.Project;
import com.nexuspm.report.dto.OrgBreakdownProjectItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

    @Query(value = """
            SELECT DISTINCT p FROM Project p
            JOIN FETCH p.client c
            JOIN FETCH c.country co
            JOIN FETCH co.region
            LEFT JOIN FETCH p.leadEmployee
            LEFT JOIN FETCH p.architectEmployee
            LEFT JOIN FETCH p.engineeringManagerManagement em
            LEFT JOIN FETCH em.supervisor
            WHERE p.deleted = FALSE
            AND (:includeArchived = TRUE OR p.archived = FALSE)
            AND (
                :admin = TRUE
                OR p.leadEmployee.id = :employeeId
                OR p.architectEmployee.id = :employeeId
                OR (:teamManagementId IS NOT NULL AND p.engineeringManagerManagement.id = :teamManagementId)
                OR (:managerFullName IS NOT NULL AND p.engineeringManagerManagement IS NOT NULL
                    AND LOWER(CONCAT(p.engineeringManagerManagement.firstName, ' ', p.engineeringManagerManagement.lastName))
                        = LOWER(:managerFullName))
                OR (:engineeringPortfolioWide = TRUE AND p.engineeringManagerManagement IS NOT NULL)
                OR (:vpEmScope = TRUE AND p.engineeringManagerManagement.id IN :emManagementIds)
                OR EXISTS (
                    SELECT 1 FROM ProjectAccess pa
                    WHERE pa.project = p AND pa.employee.id = :employeeId
                )
            )
            AND (:clientId IS NULL OR c.id = :clientId)
            AND (:regionId IS NULL OR co.region.id = :regionId)
            AND (:countryId IS NULL OR co.id = :countryId)
            AND (:status IS NULL OR p.status = :status)
            AND (:ragStatus IS NULL OR p.ragStatus = :ragStatus)
            AND (:filterByVpEms = FALSE OR p.engineeringManagerManagement.id IN :vpFilterEmIds)
            AND (:engineeringManagerManagementId IS NULL OR p.engineeringManagerManagement.id = :engineeringManagerManagementId)
            """,
            countQuery = """
            SELECT COUNT(DISTINCT p.id) FROM Project p
            JOIN p.client c
            JOIN c.country co
            WHERE p.deleted = FALSE
            AND (:includeArchived = TRUE OR p.archived = FALSE)
            AND (
                :admin = TRUE
                OR p.leadEmployee.id = :employeeId
                OR p.architectEmployee.id = :employeeId
                OR (:teamManagementId IS NOT NULL AND p.engineeringManagerManagement.id = :teamManagementId)
                OR (:managerFullName IS NOT NULL AND p.engineeringManagerManagement IS NOT NULL
                    AND LOWER(CONCAT(p.engineeringManagerManagement.firstName, ' ', p.engineeringManagerManagement.lastName))
                        = LOWER(:managerFullName))
                OR (:engineeringPortfolioWide = TRUE AND p.engineeringManagerManagement IS NOT NULL)
                OR (:vpEmScope = TRUE AND p.engineeringManagerManagement.id IN :emManagementIds)
                OR EXISTS (
                    SELECT 1 FROM ProjectAccess pa
                    WHERE pa.project = p AND pa.employee.id = :employeeId
                )
            )
            AND (:clientId IS NULL OR c.id = :clientId)
            AND (:regionId IS NULL OR co.region.id = :regionId)
            AND (:countryId IS NULL OR co.id = :countryId)
            AND (:status IS NULL OR p.status = :status)
            AND (:ragStatus IS NULL OR p.ragStatus = :ragStatus)
            AND (:filterByVpEms = FALSE OR p.engineeringManagerManagement.id IN :vpFilterEmIds)
            AND (:engineeringManagerManagementId IS NULL OR p.engineeringManagerManagement.id = :engineeringManagerManagementId)
            """)
    Page<Project> findAccessible(
            @Param("employeeId") UUID employeeId,
            @Param("teamManagementId") UUID teamManagementId,
            @Param("managerFullName") String managerFullName,
            @Param("admin") boolean admin,
            @Param("engineeringPortfolioWide") boolean engineeringPortfolioWide,
            @Param("vpEmScope") boolean vpEmScope,
            @Param("emManagementIds") List<UUID> emManagementIds,
            @Param("includeArchived") boolean includeArchived,
            @Param("clientId") UUID clientId,
            @Param("regionId") UUID regionId,
            @Param("countryId") UUID countryId,
            @Param("status") String status,
            @Param("ragStatus") String ragStatus,
            @Param("filterByVpEms") boolean filterByVpEms,
            @Param("vpFilterEmIds") List<UUID> vpFilterEmIds,
            @Param("engineeringManagerManagementId") UUID engineeringManagerManagementId,
            Pageable pageable);

    @Query("""
            SELECT p FROM Project p
            JOIN FETCH p.client c
            JOIN FETCH c.country co
            LEFT JOIN FETCH p.leadEmployee
            LEFT JOIN FETCH p.architectEmployee
            LEFT JOIN FETCH p.engineeringManagerManagement em
            LEFT JOIN FETCH em.supervisor
            WHERE p.deleted = FALSE
              AND p.archived = FALSE
              AND (:ids IS NULL OR p.id IN :ids)
            ORDER BY
              CASE WHEN p.engineeringManagerManagement IS NULL THEN 1 ELSE 0 END,
              LOWER(CONCAT(
                  COALESCE(p.engineeringManagerManagement.firstName, ''),
                  ' ',
                  COALESCE(p.engineeringManagerManagement.lastName, '')
              )),
              LOWER(p.name)
            """)
    List<Project> findActiveDetailedForMatrix(@Param("ids") Collection<UUID> ids);

    @Query("""
            SELECT p FROM Project p
            JOIN FETCH p.client c
            JOIN FETCH c.country co
            JOIN FETCH co.region
            LEFT JOIN FETCH p.leadEmployee
            LEFT JOIN FETCH p.architectEmployee
            LEFT JOIN FETCH p.engineeringManagerManagement em
            LEFT JOIN FETCH em.supervisor
            WHERE p.id = :id AND p.deleted = FALSE
            """)
    Optional<Project> findDetailedByIdAndDeletedFalse(@Param("id") UUID id);

    @Query("""
            SELECT p FROM Project p
            JOIN FETCH p.client c
            JOIN FETCH c.country co
            JOIN FETCH co.region
            LEFT JOIN FETCH p.leadEmployee
            LEFT JOIN FETCH p.architectEmployee
            LEFT JOIN FETCH p.engineeringManagerManagement em
            LEFT JOIN FETCH em.supervisor
            WHERE p.id = :id
            """)
    Optional<Project> findDetailedById(@Param("id") UUID id);

    boolean existsByClientIdAndNameIgnoreCase(UUID clientId, String name);

    Optional<Project> findByClientIdAndNameIgnoreCase(UUID clientId, String name);

    @Query("""
            SELECT p FROM Project p
            WHERE p.deleted = false
              AND (
                LOWER(TRIM(p.product)) = LOWER(TRIM(:key))
                OR LOWER(TRIM(p.name)) = LOWER(TRIM(:key))
              )
            """)
    List<Project> findActiveByProductOrNameIgnoreCase(@Param("key") String key);

    long countByClientId(UUID clientId);

    @Query("""
            SELECT COUNT(DISTINCT p) FROM Project p
            WHERE p.archived = false AND p.status = 'ACTIVE'
            AND (
                :admin = TRUE
                OR p.leadEmployee.id = :employeeId
                OR p.architectEmployee.id = :employeeId
                OR (:teamManagementId IS NOT NULL AND p.engineeringManagerManagement.id = :teamManagementId)
                OR (:managerFullName IS NOT NULL AND p.engineeringManagerManagement IS NOT NULL
                    AND LOWER(CONCAT(p.engineeringManagerManagement.firstName, ' ', p.engineeringManagerManagement.lastName))
                        = LOWER(:managerFullName))
                OR (:engineeringPortfolioWide = TRUE AND p.engineeringManagerManagement IS NOT NULL)
                OR (:vpEmScope = TRUE AND p.engineeringManagerManagement.id IN :emManagementIds)
                OR EXISTS (
                    SELECT 1 FROM ProjectAccess pa
                    WHERE pa.project = p AND pa.employee.id = :employeeId
                )
            )
            """)
    long countActiveAccessible(
            @Param("employeeId") UUID employeeId,
            @Param("teamManagementId") UUID teamManagementId,
            @Param("managerFullName") String managerFullName,
            @Param("admin") boolean admin,
            @Param("engineeringPortfolioWide") boolean engineeringPortfolioWide,
            @Param("vpEmScope") boolean vpEmScope,
            @Param("emManagementIds") List<UUID> emManagementIds);

    @Query("""
            SELECT DISTINCT p.id FROM Project p
            WHERE p.leadEmployee.id = :employeeId
               OR p.architectEmployee.id = :employeeId
               OR (:teamManagementId IS NOT NULL AND p.engineeringManagerManagement.id = :teamManagementId)
               OR (:managerFullName IS NOT NULL AND p.engineeringManagerManagement IS NOT NULL
                   AND LOWER(CONCAT(p.engineeringManagerManagement.firstName, ' ', p.engineeringManagerManagement.lastName))
                       = LOWER(:managerFullName))
               OR (:engineeringPortfolioWide = TRUE AND p.engineeringManagerManagement IS NOT NULL)
               OR (:vpEmScope = TRUE AND p.engineeringManagerManagement.id IN :emManagementIds)
               OR EXISTS (
                   SELECT 1 FROM ProjectAccess pa
                   WHERE pa.project = p AND pa.employee.id = :employeeId
               )
            """)
    List<UUID> findAccessibleProjectIds(
            @Param("employeeId") UUID employeeId,
            @Param("teamManagementId") UUID teamManagementId,
            @Param("managerFullName") String managerFullName,
            @Param("engineeringPortfolioWide") boolean engineeringPortfolioWide,
            @Param("vpEmScope") boolean vpEmScope,
            @Param("emManagementIds") List<UUID> emManagementIds);

    @Query("SELECT COUNT(p) FROM Project p WHERE p.deleted = false AND p.archived = false")
    long countNonArchived();

    @Query("""
            SELECT new com.nexuspm.report.dto.OrgBreakdownProjectItem(
                p.name, co.region.name, co.name)
            FROM Project p
            JOIN p.client c
            JOIN c.country co
            WHERE p.deleted = false AND p.archived = false
            ORDER BY co.region.name, co.name, p.name
            """)
    List<OrgBreakdownProjectItem> findAllBreakdownProjectsNonArchived();

    @Query("""
            SELECT COUNT(p) FROM Project p
            WHERE p.deleted = false AND p.archived = false
              AND p.engineeringManagerManagement.id IN :emIds
            """)
    long countByEngineeringManagerIds(@Param("emIds") Collection<UUID> emIds);

    @Query("""
            SELECT new com.nexuspm.report.dto.OrgBreakdownProjectItem(
                p.name, co.region.name, co.name)
            FROM Project p
            JOIN p.client c
            JOIN c.country co
            WHERE p.deleted = false AND p.archived = false
              AND p.engineeringManagerManagement.id IN :emIds
            ORDER BY co.region.name, co.name, p.name
            """)
    List<OrgBreakdownProjectItem> findBreakdownProjectsByEngineeringManagerIds(
            @Param("emIds") Collection<UUID> emIds);

    @Query("""
            SELECT new com.nexuspm.report.dto.OrgBreakdownProjectItem(
                p.name, co.region.name, co.name)
            FROM Project p
            JOIN p.client c
            JOIN c.country co
            WHERE p.deleted = false AND p.archived = false AND p.engineeringManagerManagement.id = :emId
            ORDER BY co.region.name, co.name, p.name
            """)
    List<OrgBreakdownProjectItem> findBreakdownProjectsByEngineeringManagerManagementId(
            @Param("emId") UUID emId);

    @Modifying
    @Query("UPDATE Project p SET p.engineeringManagerManagement = NULL WHERE p.engineeringManagerManagement.id = :managementId")
    void clearEngineeringManagerManagement(@Param("managementId") UUID managementId);

    @Modifying
    @Query("UPDATE Project p SET p.engineeringManagerManagement = NULL WHERE p.engineeringManagerManagement IS NOT NULL")
    void clearAllEngineeringManagerManagement();

    @Modifying
    @Query("UPDATE Project p SET p.leadEmployee = NULL WHERE p.leadEmployee.id IN :employeeIds")
    void clearLeadEmployeeByEmployeeIds(@Param("employeeIds") List<UUID> employeeIds);

    @Modifying
    @Query("UPDATE Project p SET p.architectEmployee = NULL WHERE p.architectEmployee.id IN :employeeIds")
    void clearArchitectEmployeeByEmployeeIds(@Param("employeeIds") List<UUID> employeeIds);
}
