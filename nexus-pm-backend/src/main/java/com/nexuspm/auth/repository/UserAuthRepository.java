package com.nexuspm.auth.repository;

import com.nexuspm.auth.entity.UserAuth;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserAuthRepository extends JpaRepository<UserAuth, UUID> {

    @Query("""
            SELECT ua FROM UserAuth ua
            JOIN FETCH ua.employee e
            LEFT JOIN FETCH e.roles r
            LEFT JOIN FETCH r.orgLevel
            LEFT JOIN FETCH e.department
            WHERE ua.employee.email = :email
            """)
    Optional<UserAuth> findByEmployeeEmail(String email);

    @Query("""
            SELECT ua FROM UserAuth ua
            JOIN FETCH ua.employee e
            LEFT JOIN FETCH e.roles r
            LEFT JOIN FETCH r.orgLevel
            LEFT JOIN FETCH e.department
            WHERE ua.employee.id = :employeeId
            """)
    Optional<UserAuth> findByEmployeeId(UUID employeeId);

    boolean existsByEmployeeId(UUID employeeId);

    @Query("""
            SELECT ua FROM UserAuth ua
            JOIN FETCH ua.employee e
            LEFT JOIN FETCH e.teamManagement tm
            LEFT JOIN FETCH e.roles r
            LEFT JOIN FETCH r.orgLevel
            LEFT JOIN FETCH e.department
            LEFT JOIN FETCH e.designation
            LEFT JOIN FETCH e.manager
            WHERE (:search IS NULL OR :search = '' OR
                   LOWER(CONCAT(e.firstName, ' ', e.lastName)) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(e.email) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(tm.roleTitle, '')) LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY e.lastName, e.firstName
            """)
    List<UserAuth> findAllWithEmployee(String search);
}
