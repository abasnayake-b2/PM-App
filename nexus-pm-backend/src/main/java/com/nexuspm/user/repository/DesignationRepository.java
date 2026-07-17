package com.nexuspm.user.repository;

import com.nexuspm.user.entity.Designation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DesignationRepository extends JpaRepository<Designation, UUID> {

    @Query("SELECT d FROM Designation d LEFT JOIN FETCH d.department LEFT JOIN FETCH d.stream ORDER BY d.name")
    List<Designation> findAllWithDepartment();

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, UUID id);

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, UUID id);

    boolean existsByStream_Id(UUID streamId);

    Optional<Designation> findByCodeIgnoreCase(String code);

    Optional<Designation> findByNameIgnoreCase(String name);
}
