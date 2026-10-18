package com.nexuspm.lookup.repository;

import com.nexuspm.lookup.entity.WorkCategoryManager;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface WorkCategoryManagerRepository extends JpaRepository<WorkCategoryManager, UUID> {

    @Query("""
            SELECT m.engineeringManager.id
            FROM WorkCategoryManager m
            WHERE m.workCategory.id = :workCategoryId
            """)
    List<UUID> findManagerIdsByWorkCategoryId(@Param("workCategoryId") UUID workCategoryId);

    @Query("""
            SELECT m FROM WorkCategoryManager m
            JOIN FETCH m.workCategory
            JOIN FETCH m.engineeringManager
            """)
    List<WorkCategoryManager> findAllWithManager();

    boolean existsByWorkCategory_Id(UUID workCategoryId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM WorkCategoryManager m WHERE m.workCategory.id = :workCategoryId")
    void deleteByWorkCategoryId(@Param("workCategoryId") UUID workCategoryId);
}
