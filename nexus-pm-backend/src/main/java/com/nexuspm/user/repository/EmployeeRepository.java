package com.nexuspm.user.repository;

import com.nexuspm.user.entity.Employee;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmployeeRepository extends JpaRepository<Employee, UUID> {

    Optional<Employee> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.roles r
            LEFT JOIN FETCH r.orgLevel ol
            LEFT JOIN FETCH ol.reportsToOrgLevel
            LEFT JOIN FETCH e.department
            LEFT JOIN FETCH e.designation
            LEFT JOIN FETCH e.stream
            LEFT JOIN FETCH e.workType
            LEFT JOIN FETCH e.country
            LEFT JOIN FETCH e.engineeringManagerManagement
            LEFT JOIN FETCH e.manager
            LEFT JOIN FETCH e.teamManagement
            WHERE e.id = :id
            """)
    Optional<Employee> findDetailedById(UUID id);

    @Query(value = "SELECT e FROM Employee e LEFT JOIN FETCH e.roles",
            countQuery = "SELECT COUNT(e) FROM Employee e")
    Page<Employee> findAllWithRoles(Pageable pageable);

    @Query(value = """
            SELECT DISTINCT e FROM Employee e
            LEFT JOIN FETCH e.roles
            LEFT JOIN FETCH e.department
            LEFT JOIN FETCH e.designation
            LEFT JOIN FETCH e.stream
            LEFT JOIN FETCH e.manager
            WHERE (:search IS NULL OR :search = '' OR
                   LOWER(CONCAT(e.firstName, ' ', e.lastName)) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(e.email) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:filterByRole = false OR EXISTS (
                   SELECT 1 FROM Role r WHERE r MEMBER OF e.roles AND r.code IN :roleCodes))
            """,
            countQuery = """
            SELECT COUNT(DISTINCT e) FROM Employee e
            WHERE (:search IS NULL OR :search = '' OR
                   LOWER(CONCAT(e.firstName, ' ', e.lastName)) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(e.email) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:filterByRole = false OR EXISTS (
                   SELECT 1 FROM Role r WHERE r MEMBER OF e.roles AND r.code IN :roleCodes))
            """)
    Page<Employee> findFiltered(String search, boolean filterByRole, List<String> roleCodes, Pageable pageable);

    @Query("""
            SELECT DISTINCT e FROM Employee e
            JOIN e.roles r
            WHERE r.code IN ('VP', 'VP_ENG')
              AND LOWER(CONCAT(e.firstName, ' ', e.lastName)) LIKE LOWER(CONCAT('%', :term, '%'))
            """)
    List<Employee> findVpsByNameMatch(String term);

    @Query("""
            SELECT DISTINCT m FROM Employee m
            JOIN m.roles r
            LEFT JOIN FETCH m.roles
            LEFT JOIN FETCH m.department
            LEFT JOIN FETCH m.designation
            LEFT JOIN FETCH m.manager
            WHERE r.code IN ('MANAGER', 'SEM')
              AND LOWER(CONCAT(m.firstName, ' ', m.lastName)) LIKE LOWER(CONCAT('%', :term, '%'))
            ORDER BY m.lastName, m.firstName
            """)
    List<Employee> findManagersByNameMatch(String term);

    @Query("""
            SELECT DISTINCT m FROM Employee m
            JOIN m.roles r
            LEFT JOIN FETCH m.roles
            LEFT JOIN FETCH m.department
            LEFT JOIN FETCH m.designation
            LEFT JOIN FETCH m.manager
            WHERE r.code IN ('MANAGER', 'SEM')
              AND m.manager.id IN :vpIds
            ORDER BY m.lastName, m.firstName
            """)
    List<Employee> findManagersReportingToVps(List<UUID> vpIds);

    @Query("""
            SELECT DISTINCT e FROM Employee e
            JOIN e.roles r
            LEFT JOIN FETCH e.roles
            LEFT JOIN FETCH e.department
            LEFT JOIN FETCH e.designation
            LEFT JOIN FETCH e.manager
            WHERE r.code = 'SW_ENGINEER'
              AND e.manager.id IN :managerIds
            ORDER BY e.lastName, e.firstName
            """)
    List<Employee> findEmployeesReportingToManagers(List<UUID> managerIds);

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.department
            LEFT JOIN FETCH e.designation
            WHERE e.status = 'ACTIVE'
              AND e.manager.id = :managerId
            ORDER BY e.lastName, e.firstName
            """)
    List<Employee> findDirectReports(UUID managerId);

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.department
            LEFT JOIN FETCH e.designation
            LEFT JOIN FETCH e.engineeringManagerManagement em
            WHERE e.status = 'ACTIVE'
              AND em.id = :managementId
            ORDER BY e.lastName, e.firstName
            """)
    List<Employee> findByEngineeringManagerManagementId(UUID managementId);

    @Query("""
            SELECT DISTINCT e FROM Employee e
            LEFT JOIN FETCH e.department
            LEFT JOIN FETCH e.designation
            LEFT JOIN FETCH e.manager
            LEFT JOIN e.roles r
            WHERE e.status = 'ACTIVE'
              AND (:departmentId IS NULL OR e.department.id = :departmentId)
              AND (:filterByRole = false OR r.code IN :roleCodes)
              AND (:name IS NULL OR :name = '' OR LOWER(CONCAT(e.firstName, ' ', e.lastName)) LIKE LOWER(CONCAT('%', :name, '%')))
            ORDER BY e.lastName, e.firstName
            """)
    List<Employee> findActiveEmployees(UUID departmentId, boolean filterByRole, List<String> roleCodes, String name);

    @Query("""
            SELECT CASE WHEN COUNT(e) > 0 THEN true ELSE false END
            FROM Employee e JOIN e.roles r
            WHERE r.id = :roleId
            """)
    boolean isRoleAssignedToEmployee(UUID roleId);

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.designation d
            LEFT JOIN FETCH d.stream
            LEFT JOIN FETCH d.department
            LEFT JOIN FETCH e.stream
            LEFT JOIN FETCH e.workType
            LEFT JOIN FETCH e.country
            LEFT JOIN FETCH e.engineeringManagerManagement em
            LEFT JOIN FETCH em.supervisor vp
            LEFT JOIN FETCH vp.supervisor vp2
            LEFT JOIN FETCH e.teamManagement
            LEFT JOIN FETCH e.department
            WHERE e.status = 'ACTIVE'
              AND e.teamManagement IS NULL
              AND (:search IS NULL OR :search = '' OR
                   LOWER(CONCAT(e.firstName, ' ', e.lastName)) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.firstName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.lastName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(d.name, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(d.code, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.stream.name, d.stream.name, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(CONCAT(COALESCE(em.firstName, ''), ' ', COALESCE(em.lastName, '')))
                        LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(em.firstName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(em.lastName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(CONCAT(COALESCE(vp.firstName, ''), ' ', COALESCE(vp.lastName, '')))
                        LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(vp.firstName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(vp.lastName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(CONCAT(COALESCE(vp2.firstName, ''), ' ', COALESCE(vp2.lastName, '')))
                        LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(vp2.firstName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(vp2.lastName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.country.name, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.country.code, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.workType.name, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.product, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.email, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.phone, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.status, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR CAST(e.totalYearsOfExperience AS string) LIKE CONCAT('%', :search, '%')
                   OR CAST(e.experienceInDfn AS string) LIKE CONCAT('%', :search, '%')
                   OR EXISTS (
                        SELECT 1 FROM e.skills sk
                        WHERE LOWER(sk.name) LIKE LOWER(CONCAT('%', :search, '%'))
                   ))
            ORDER BY e.firstName, e.lastName
            """)
    List<Employee> searchRosterMembers(String search);

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.designation d
            LEFT JOIN FETCH d.stream
            LEFT JOIN FETCH e.stream
            LEFT JOIN FETCH e.workType
            LEFT JOIN FETCH e.country
            LEFT JOIN FETCH e.engineeringManagerManagement em
            LEFT JOIN FETCH em.supervisor
            WHERE e.status = 'ACTIVE'
              AND e.teamManagement IS NULL
              AND (:name IS NULL OR :name = '' OR
                   LOWER(CONCAT(e.firstName, ' ', e.lastName)) LIKE LOWER(CONCAT('%', :name, '%'))
                   OR LOWER(COALESCE(d.name, '')) LIKE LOWER(CONCAT('%', :name, '%'))
                   OR LOWER(COALESCE(d.code, '')) LIKE LOWER(CONCAT('%', :name, '%'))
                   OR LOWER(COALESCE(e.stream.name, d.stream.name, '')) LIKE LOWER(CONCAT('%', :name, '%'))
                   OR LOWER(COALESCE(e.engineeringManagerManagement.firstName, '')) LIKE LOWER(CONCAT('%', :name, '%'))
                   OR LOWER(COALESCE(e.engineeringManagerManagement.lastName, '')) LIKE LOWER(CONCAT('%', :name, '%'))
                   OR LOWER(COALESCE(e.country.name, '')) LIKE LOWER(CONCAT('%', :name, '%'))
                   OR LOWER(COALESCE(e.country.code, '')) LIKE LOWER(CONCAT('%', :name, '%'))
                   OR LOWER(COALESCE(e.workType.name, '')) LIKE LOWER(CONCAT('%', :name, '%'))
                   OR LOWER(COALESCE(e.email, '')) LIKE LOWER(CONCAT('%', :name, '%')))
              AND (:team IS NULL OR :team = '' OR LOWER(COALESCE(e.stream.name, d.stream.name, '')) = LOWER(:team))
              AND (:designationCode IS NULL OR :designationCode = '' OR LOWER(COALESCE(d.code, '')) = LOWER(:designationCode))
              AND (:engineeringManager IS NULL OR :engineeringManager = '' OR
                   LOWER(CONCAT(COALESCE(e.engineeringManagerManagement.firstName, ''), ' ',
                                COALESCE(e.engineeringManagerManagement.lastName, '')))
                       LIKE LOWER(CONCAT('%', :engineeringManager, '%')))
            ORDER BY e.firstName, e.lastName
            """)
    List<Employee> findActiveRosterFiltered(
            String name, String team, String designationCode, String engineeringManager);

    @Query("""
            SELECT DISTINCT CONCAT(em.firstName, ' ', em.lastName) FROM Employee e
            JOIN e.engineeringManagerManagement em
            WHERE e.status = 'ACTIVE'
              AND e.teamManagement IS NULL
            ORDER BY CONCAT(em.firstName, ' ', em.lastName)
            """)
    List<String> findDistinctEngineeringManagers();

    @Query("""
            SELECT e.id FROM Employee e
            WHERE NOT EXISTS (SELECT 1 FROM UserAuth ua WHERE ua.employee.id = e.id)
            """)
    List<UUID> findRosterEmployeeIdsWithoutLogin();

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.department
            LEFT JOIN FETCH e.designation d
            LEFT JOIN FETCH d.department
            LEFT JOIN FETCH e.manager
            LEFT JOIN FETCH e.engineeringManagerManagement
            LEFT JOIN FETCH e.teamManagement
            WHERE e.status = 'ACTIVE'
              AND e.teamManagement IS NULL
              AND NOT EXISTS (SELECT 1 FROM UserAuth ua WHERE ua.employee.id = e.id)
              AND (:search IS NULL OR :search = ''
                   OR LOWER(CONCAT(e.firstName, ' ', e.lastName)) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.email, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(d.name, '')) LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY e.firstName, e.lastName
            """)
    List<Employee> findEligibleForUserAccount(@Param("search") String search);

    boolean existsByTeamManagementId(UUID teamManagementId);

    Optional<Employee> findByTeamManagementId(UUID teamManagementId);

    @Query("""
            SELECT e FROM Employee e
            JOIN FETCH e.teamManagement
            WHERE e.teamManagement IS NOT NULL
            """)
    List<Employee> findAllLinkedToManagement();

    @Query("""
            SELECT e FROM Employee e
            WHERE LOWER(CONCAT(e.firstName, ' ', e.lastName)) = LOWER(:fullName)
            """)
    Optional<Employee> findByFullNameIgnoreCase(String fullName);

    @Query("""
            SELECT COUNT(e) FROM Employee e
            WHERE e.status = 'ACTIVE'
              AND e.teamManagement IS NULL
            """)
    long countActiveRosterEmployees();

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.designation
            WHERE e.status = 'ACTIVE'
              AND e.teamManagement IS NULL
            ORDER BY e.firstName, e.lastName
            """)
    List<Employee> findActiveRosterEmployees();

    @Query("""
            SELECT COUNT(e) FROM Employee e
            WHERE e.status = 'ACTIVE'
            """)
    long countActiveEmployees();

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.designation
            LEFT JOIN FETCH e.engineeringManagerManagement
            WHERE e.status = 'ACTIVE'
              AND e.engineeringManagerManagement IS NOT NULL
            ORDER BY e.firstName, e.lastName
            """)
    List<Employee> findActiveEngineersWithManager();

    @Modifying(clearAutomatically = true)
    @Query("UPDATE Employee e SET e.manager = NULL WHERE e.manager.id IN :employeeIds")
    void clearManagerReferences(@Param("employeeIds") List<UUID> employeeIds);

    @Modifying(clearAutomatically = true)
    @Query("""
            UPDATE Employee e
            SET e.engineeringManagerManagement = NULL
            WHERE e.engineeringManagerManagement.id = :managementId
            """)
    void clearEngineeringManagerManagement(@Param("managementId") UUID managementId);

    @Modifying
    @Query(value = "DELETE FROM employee_role WHERE employee_id IN (:employeeIds)", nativeQuery = true)
    void deleteRoleLinks(@Param("employeeIds") List<UUID> employeeIds);

    @Modifying
    @Query(value = "DELETE FROM employee_skill WHERE employee_id IN (:employeeIds)", nativeQuery = true)
    void deleteSkillLinks(@Param("employeeIds") List<UUID> employeeIds);
}
