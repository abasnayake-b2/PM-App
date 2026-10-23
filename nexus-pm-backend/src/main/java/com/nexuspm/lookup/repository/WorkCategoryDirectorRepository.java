package com.nexuspm.lookup.repository;

import com.nexuspm.lookup.entity.WorkCategoryDirector;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface WorkCategoryDirectorRepository extends JpaRepository<WorkCategoryDirector, UUID> {

    @Query("""
            SELECT d FROM WorkCategoryDirector d
            JOIN FETCH d.workCategory
            JOIN FETCH d.director
            """)
    List<WorkCategoryDirector> findAllWithDirector();

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM WorkCategoryDirector d WHERE d.workCategory.id = :workCategoryId")
    void deleteByWorkCategoryId(@Param("workCategoryId") UUID workCategoryId);
}
