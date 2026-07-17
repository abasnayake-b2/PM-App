package com.nexuspm.user.repository;

import com.nexuspm.user.entity.OrgLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrgLevelRepository extends JpaRepository<OrgLevel, UUID> {

    Optional<OrgLevel> findByCode(String code);

    @Query("SELECT o FROM OrgLevel o LEFT JOIN FETCH o.reportsToOrgLevel ORDER BY o.levelOrder")
    List<OrgLevel> findAllOrdered();
}
