package com.nexuspm.user.repository;

import com.nexuspm.user.entity.Stream;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StreamRepository extends JpaRepository<Stream, UUID> {

    @Query("SELECT s FROM Stream s LEFT JOIN FETCH s.department ORDER BY s.name")
    List<Stream> findAllWithDepartment();

    boolean existsByDepartment_Id(UUID departmentId);

    @Query("""
            SELECT s FROM Stream s
            LEFT JOIN FETCH s.department
            WHERE LOWER(TRIM(s.name)) = LOWER(TRIM(:name))
            """)
    Optional<Stream> findByNameIgnoreCase(@Param("name") String name);
}
