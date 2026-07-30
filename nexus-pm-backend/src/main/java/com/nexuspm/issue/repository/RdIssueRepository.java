package com.nexuspm.issue.repository;

import com.nexuspm.issue.entity.RdIssue;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RdIssueRepository extends JpaRepository<RdIssue, UUID> {

    Optional<RdIssue> findByProjectIdAndTitleIgnoreCaseAndDeletedFalse(UUID projectId, String title);

    long countByDisplayKeyIsNull();

    @Query("""
            SELECT i FROM RdIssue i
            JOIN FETCH i.project
            JOIN FETCH i.issueType
            LEFT JOIN FETCH i.parentIssue parent
            LEFT JOIN FETCH parent.issueType
            WHERE i.displayKey IS NULL
            ORDER BY CASE WHEN i.parentIssue IS NULL THEN 0 ELSE 1 END, i.createdAt, i.id
            """)
    List<RdIssue> findAllMissingDisplayKey();

    @Query("""
            SELECT i FROM RdIssue i
            JOIN FETCH i.project
            JOIN FETCH i.issueType
            WHERE i.rdNumber IS NOT NULL
            """)
    List<RdIssue> findAllWithRdNumber();

    @Query("""
            SELECT COALESCE(MAX(i.rdNumber), 0) FROM RdIssue i
            WHERE i.project.id = :projectId
            """)
    int findMaxRdNumberByProjectId(@Param("projectId") UUID projectId);

    @Query("""
            SELECT COALESCE(MAX(i.childNumber), 0) FROM RdIssue i
            WHERE i.parentIssue.id = :parentId
              AND UPPER(i.issueType.workflowCode) = UPPER(:workflowCode)
            """)
    int findMaxChildNumberByParentAndWorkflow(
            @Param("parentId") UUID parentId,
            @Param("workflowCode") String workflowCode);

    @Query("""
            SELECT COALESCE(MAX(i.childNumber), 0) FROM RdIssue i
            WHERE i.project.id = :projectId
              AND i.rdNumber = :rdNumber
              AND i.parentIssue IS NOT NULL
              AND UPPER(i.issueType.workflowCode) = UPPER(:workflowCode)
            """)
    int findMaxChildNumberByProjectRdAndWorkflow(
            @Param("projectId") UUID projectId,
            @Param("rdNumber") int rdNumber,
            @Param("workflowCode") String workflowCode);

    @Query("""
            SELECT i FROM RdIssue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release r
            JOIN FETCH i.issueType
            JOIN FETCH i.priority
            JOIN FETCH i.status
            LEFT JOIN FETCH i.reportedBy
            LEFT JOIN FETCH i.assignedTo
            LEFT JOIN FETCH i.parentIssue parent
            LEFT JOIN FETCH parent.issueType
            WHERE i.id = :id AND i.deleted = false
            """)
    Optional<RdIssue> findDetailedById(@Param("id") UUID id);

    @Query("""
            SELECT i FROM RdIssue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release r
            JOIN FETCH i.issueType
            JOIN FETCH i.priority
            JOIN FETCH i.status
            LEFT JOIN FETCH i.reportedBy
            LEFT JOIN FETCH i.assignedTo
            LEFT JOIN FETCH i.parentIssue parent
            LEFT JOIN FETCH parent.issueType
            WHERE i.id = :id
            """)
    Optional<RdIssue> findAnyDetailedById(@Param("id") UUID id);

    @Query(value = """
            SELECT i FROM RdIssue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release r
            JOIN FETCH i.issueType
            JOIN FETCH i.priority
            JOIN FETCH i.status
            LEFT JOIN FETCH i.reportedBy
            LEFT JOIN FETCH i.assignedTo
            LEFT JOIN i.parentIssue parent
            WHERE (:releaseId IS NULL OR r.id = :releaseId)
              AND (:projectId IS NULL OR p.id = :projectId)
              AND (:scopedProjectIds IS NULL OR p.id IN :scopedProjectIds)
              AND (:unreleasedOnly = FALSE OR i.release IS NULL)
              AND (:filterByStatusIds = FALSE OR i.status.id IN :statusIds)
              AND (:slaStatus IS NULL OR i.slaStatus = :slaStatus)
              AND (:assignedToId IS NULL OR i.assignedTo.id = :assignedToId)
              AND (:priorityId IS NULL OR i.priority.id = :priorityId)
              AND (:issueTypeId IS NULL OR i.issueType.id = :issueTypeId)
              AND (
                    :hasSearch = FALSE
                    OR LOWER(i.title) LIKE :searchPattern
                    OR LOWER(p.name) LIKE :searchPattern
                    OR (p.product IS NOT NULL AND LOWER(p.product) LIKE :searchPattern)
                    OR (i.component IS NOT NULL AND LOWER(i.component) LIKE :searchPattern)
                    OR LOWER(i.status.name) LIKE :searchPattern
                    OR (i.assignedTo IS NOT NULL AND (
                        LOWER(CONCAT(i.assignedTo.firstName, ' ', i.assignedTo.lastName)) LIKE :searchPattern
                        OR LOWER(i.assignedTo.firstName) LIKE :searchPattern
                        OR LOWER(i.assignedTo.lastName) LIKE :searchPattern
                    ))
                    OR (:hasIdHint = TRUE AND (
                        LOWER(REPLACE(CAST(i.id AS string), '-', '')) LIKE :idHintPattern
                        OR LOWER(CAST(i.id AS string)) LIKE :idHintDashedPattern
                    ))
                    OR (i.displayKey IS NOT NULL AND LOWER(i.displayKey) LIKE :searchPattern)
              )
              AND i.deleted = false
            """,
            countQuery = """
            SELECT COUNT(i) FROM RdIssue i
            JOIN i.project p
            LEFT JOIN i.release r
            JOIN i.status st
            LEFT JOIN i.assignedTo a
            WHERE (:releaseId IS NULL OR r.id = :releaseId)
              AND (:projectId IS NULL OR p.id = :projectId)
              AND (:scopedProjectIds IS NULL OR p.id IN :scopedProjectIds)
              AND (:unreleasedOnly = FALSE OR i.release IS NULL)
              AND (:filterByStatusIds = FALSE OR i.status.id IN :statusIds)
              AND (:slaStatus IS NULL OR i.slaStatus = :slaStatus)
              AND (:assignedToId IS NULL OR i.assignedTo.id = :assignedToId)
              AND (:priorityId IS NULL OR i.priority.id = :priorityId)
              AND (:issueTypeId IS NULL OR i.issueType.id = :issueTypeId)
              AND (
                    :hasSearch = FALSE
                    OR LOWER(i.title) LIKE :searchPattern
                    OR LOWER(p.name) LIKE :searchPattern
                    OR (p.product IS NOT NULL AND LOWER(p.product) LIKE :searchPattern)
                    OR (i.component IS NOT NULL AND LOWER(i.component) LIKE :searchPattern)
                    OR LOWER(st.name) LIKE :searchPattern
                    OR (a IS NOT NULL AND (
                        LOWER(CONCAT(a.firstName, ' ', a.lastName)) LIKE :searchPattern
                        OR LOWER(a.firstName) LIKE :searchPattern
                        OR LOWER(a.lastName) LIKE :searchPattern
                    ))
                    OR (:hasIdHint = TRUE AND (
                        LOWER(REPLACE(CAST(i.id AS string), '-', '')) LIKE :idHintPattern
                        OR LOWER(CAST(i.id AS string)) LIKE :idHintDashedPattern
                    ))
                    OR (i.displayKey IS NOT NULL AND LOWER(i.displayKey) LIKE :searchPattern)
              )
              AND i.deleted = false
            """)
    Page<RdIssue> search(
            @Param("releaseId") UUID releaseId,
            @Param("projectId") UUID projectId,
            @Param("scopedProjectIds") java.util.Collection<UUID> scopedProjectIds,
            @Param("unreleasedOnly") boolean unreleasedOnly,
            @Param("filterByStatusIds") boolean filterByStatusIds,
            @Param("statusIds") List<UUID> statusIds,
            @Param("slaStatus") String slaStatus,
            @Param("assignedToId") UUID assignedToId,
            @Param("priorityId") UUID priorityId,
            @Param("issueTypeId") UUID issueTypeId,
            @Param("hasSearch") boolean hasSearch,
            @Param("searchPattern") String searchPattern,
            @Param("hasIdHint") boolean hasIdHint,
            @Param("idHintPattern") String idHintPattern,
            @Param("idHintDashedPattern") String idHintDashedPattern,
            Pageable pageable);

    @Query(value = """
            SELECT DISTINCT i FROM RdIssue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH p.client c
            LEFT JOIN FETCH c.country
            LEFT JOIN FETCH p.engineeringManagerManagement em
            LEFT JOIN FETCH em.supervisor
            LEFT JOIN FETCH i.release r
            JOIN FETCH i.issueType
            JOIN FETCH i.priority
            JOIN FETCH i.status
            LEFT JOIN FETCH i.reportedBy
            LEFT JOIN FETCH i.assignedTo
            WHERE i.parentIssue IS NULL
              AND (:projectId IS NULL OR p.id = :projectId)
              AND (:scopedProjectIds IS NULL OR p.id IN :scopedProjectIds)
              AND (:filterByStatusIds = FALSE OR i.status.id IN :statusIds)
              AND (:priorityId IS NULL OR i.priority.id = :priorityId)
              AND (:issueTypeId IS NULL OR i.issueType.id = :issueTypeId)
              AND (
                    :hasSearch = FALSE
                    OR LOWER(i.title) LIKE :searchPattern
                    OR LOWER(p.name) LIKE :searchPattern
                    OR (p.product IS NOT NULL AND LOWER(p.product) LIKE :searchPattern)
                    OR (i.component IS NOT NULL AND LOWER(i.component) LIKE :searchPattern)
                    OR LOWER(i.status.name) LIKE :searchPattern
                    OR (i.assignedTo IS NOT NULL AND (
                        LOWER(CONCAT(i.assignedTo.firstName, ' ', i.assignedTo.lastName)) LIKE :searchPattern
                        OR LOWER(i.assignedTo.firstName) LIKE :searchPattern
                        OR LOWER(i.assignedTo.lastName) LIKE :searchPattern
                    ))
                    OR (:hasIdHint = TRUE AND (
                        LOWER(REPLACE(CAST(i.id AS string), '-', '')) LIKE :idHintPattern
                        OR LOWER(CAST(i.id AS string)) LIKE :idHintDashedPattern
                    ))
                    OR (i.displayKey IS NOT NULL AND LOWER(i.displayKey) LIKE :searchPattern)
              )
              AND i.deleted = false
            ORDER BY p.name ASC, i.rdNumber ASC, i.createdAt ASC
            """)
    List<RdIssue> findTopLevelForExport(
            @Param("projectId") UUID projectId,
            @Param("scopedProjectIds") java.util.Collection<UUID> scopedProjectIds,
            @Param("filterByStatusIds") boolean filterByStatusIds,
            @Param("statusIds") List<UUID> statusIds,
            @Param("priorityId") UUID priorityId,
            @Param("issueTypeId") UUID issueTypeId,
            @Param("hasSearch") boolean hasSearch,
            @Param("searchPattern") String searchPattern,
            @Param("hasIdHint") boolean hasIdHint,
            @Param("idHintPattern") String idHintPattern,
            @Param("idHintDashedPattern") String idHintDashedPattern);

    @Query("""
            SELECT COUNT(i) FROM RdIssue i
            JOIN i.status s
            JOIN i.project p
            WHERE s.terminal = false
            AND i.deleted = false
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
    long countOpenAccessible(
            UUID employeeId, UUID teamManagementId, String managerFullName, boolean admin,
            boolean engineeringPortfolioWide, boolean vpEmScope, List<UUID> emManagementIds);

    @Query("""
            SELECT i FROM RdIssue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release r
            JOIN FETCH i.priority
            JOIN FETCH i.status s
            LEFT JOIN FETCH i.assignedTo
            WHERE s.terminal = false
            AND i.deleted = false
            AND (
                i.slaStatus = 'BREACHED'
                OR (i.slaStatus = 'WITHIN' AND i.slaDueAt IS NOT NULL AND i.slaDueAt <= :threshold)
            )
            AND (
                :admin = TRUE
                OR p.leadEmployee.id = :employeeId
                OR i.assignedTo.id = :employeeId
                OR EXISTS (
                    SELECT 1 FROM ProjectAccess pa
                    WHERE pa.project = p AND pa.employee.id = :employeeId
                )
            )
            ORDER BY i.slaDueAt ASC
            """)
    java.util.List<RdIssue> findSlaAtRisk(UUID employeeId, boolean admin, java.time.Instant threshold);

    @Query("""
            SELECT COUNT(i) FROM RdIssue i
            JOIN i.status s
            JOIN i.project p
            WHERE s.terminal = false
            AND i.slaStatus = 'BREACHED'
            AND (
                :admin = TRUE
                OR p.leadEmployee.id = :employeeId
                OR EXISTS (
                    SELECT 1 FROM ProjectAccess pa
                    WHERE pa.project = p AND pa.employee.id = :employeeId
                )
            )
            """)
    long countSlaBreachedAccessible(UUID employeeId, boolean admin);

    @Query("""
            SELECT COUNT(i)
            FROM RdIssue i
            WHERE i.project.id = :projectId
            """)
    long countByProjectId(UUID projectId);

    @Query("""
            SELECT COUNT(i)
            FROM RdIssue i
            JOIN i.status s
            WHERE i.project.id = :projectId
              AND s.terminal = true
            """)
    long countTerminalByProjectId(UUID projectId);

    @Query("""
            SELECT i.project.id, COUNT(i), SUM(CASE WHEN s.terminal = true THEN 1L ELSE 0L END)
            FROM RdIssue i
            JOIN i.status s
            WHERE i.project.id IN :projectIds
            GROUP BY i.project.id
            """)
    java.util.List<Object[]> countIssueProgressByProjectIds(java.util.Collection<UUID> projectIds);

    @Query("""
            SELECT i.status.id, COUNT(i)
            FROM RdIssue i
            WHERE i.deleted = false
              AND (:projectId IS NULL OR i.project.id = :projectId)
              AND (:scopedProjectIds IS NULL OR i.project.id IN :scopedProjectIds)
              AND (:unreleasedOnly = FALSE OR i.release IS NULL)
              AND (:priorityId IS NULL OR i.priority.id = :priorityId)
              AND (:issueTypeId IS NULL OR i.issueType.id = :issueTypeId)
            GROUP BY i.status.id
            """)
    List<Object[]> countByStatusFiltered(
            @Param("projectId") UUID projectId,
            @Param("scopedProjectIds") java.util.Collection<UUID> scopedProjectIds,
            @Param("unreleasedOnly") boolean unreleasedOnly,
            @Param("priorityId") UUID priorityId,
            @Param("issueTypeId") UUID issueTypeId);

    @Query("""
            SELECT i.project.id, i.status.id, COUNT(i)
            FROM RdIssue i
            WHERE i.deleted = false
              AND (:scopedProjectIds IS NULL OR i.project.id IN :scopedProjectIds)
            GROUP BY i.project.id, i.status.id
            """)
    List<Object[]> countByProjectAndStatus(
            @Param("scopedProjectIds") java.util.Collection<UUID> scopedProjectIds);

    @Query("""
            SELECT i.project.id, COUNT(i)
            FROM RdIssue i
            WHERE i.deleted = false
              AND (:scopedProjectIds IS NULL OR i.project.id IN :scopedProjectIds)
            GROUP BY i.project.id
            """)
    List<Object[]> countTotalsByProject(
            @Param("scopedProjectIds") java.util.Collection<UUID> scopedProjectIds);

    @Query("""
            SELECT i.project.id, COUNT(i)
            FROM RdIssue i
            JOIN i.status s
            WHERE i.deleted = false
              AND s.terminal = false
              AND (:scopedProjectIds IS NULL OR i.project.id IN :scopedProjectIds)
            GROUP BY i.project.id
            """)
    List<Object[]> countActiveByProject(
            @Param("scopedProjectIds") java.util.Collection<UUID> scopedProjectIds);

    @Query("""
            SELECT i.project.id, COUNT(i)
            FROM RdIssue i
            WHERE i.project.id IN :projectIds
              AND i.release IS NULL
              AND i.deleted = false
            GROUP BY i.project.id
            """)
    List<Object[]> countBacklogByProjectIds(@Param("projectIds") java.util.Collection<UUID> projectIds);

    @Query("""
            SELECT i.project.id, COUNT(i)
            FROM RdIssue i
            WHERE i.project.id IN :projectIds
              AND i.deleted = false
              AND NOT EXISTS (
                SELECT 1 FROM Allocation a
                WHERE a.issue = i
                  AND a.fromDate <= :asOf
                  AND (a.toDate IS NULL OR a.toDate >= :asOf)
              )
            GROUP BY i.project.id
            """)
    java.util.List<Object[]> countIssuesWithoutUtilizationByProjectIds(
            java.util.Collection<UUID> projectIds,
            java.time.LocalDate asOf);

    @Query("""
            SELECT i FROM RdIssue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH i.release r
            JOIN FETCH i.issueType
            JOIN FETCH i.priority
            JOIN FETCH i.status
            LEFT JOIN FETCH i.reportedBy
            LEFT JOIN FETCH i.assignedTo
            WHERE i.parentIssue.id = :parentId
              AND i.deleted = false
            ORDER BY i.createdAt ASC
            """)
    java.util.List<RdIssue> findChildrenByParentId(@Param("parentId") UUID parentId);

    @Query("""
            SELECT DISTINCT i FROM RdIssue i
            JOIN FETCH i.project p
            LEFT JOIN FETCH p.engineeringManagerManagement
            JOIN FETCH i.issueType t
            LEFT JOIN FETCH i.status
            WHERE i.deleted = false
              AND p.deleted = false
              AND p.archived = false
              AND (:scopedProjectIds IS NULL OR p.id IN :scopedProjectIds)
              AND (
                    UPPER(t.workflowCode) = 'CHANGE'
                 OR LOWER(t.name) LIKE '%change request%'
                 OR LOWER(t.name) = 'cr'
                 OR LOWER(t.name) LIKE '%amc%'
              )
            """)
    List<RdIssue> findCapacityPlanCandidates(
            @Param("scopedProjectIds") java.util.Collection<UUID> scopedProjectIds);

    @Modifying
    @Query("UPDATE RdIssue i SET i.assignedTo = NULL WHERE i.assignedTo.id IN :employeeIds")
    void clearAssigneeByEmployeeIds(@Param("employeeIds") List<UUID> employeeIds);

    @Modifying
    @Query("UPDATE RdIssue i SET i.reportedBy = NULL WHERE i.reportedBy.id IN :employeeIds")
    void clearReporterByEmployeeIds(@Param("employeeIds") List<UUID> employeeIds);

    @Modifying
    @Query("UPDATE RdIssue i SET i.release = NULL WHERE i.release.id = :releaseId")
    int clearReleaseByReleaseId(@Param("releaseId") UUID releaseId);
}
