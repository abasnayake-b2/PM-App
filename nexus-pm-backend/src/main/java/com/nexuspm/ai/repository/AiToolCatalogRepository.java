package com.nexuspm.ai.repository;

import com.nexuspm.ai.entity.AiToolCatalogEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiToolCatalogRepository extends JpaRepository<AiToolCatalogEntry, UUID> {

    List<AiToolCatalogEntry> findAllByOrderBySortOrderAscDisplayNameAsc();

    Optional<AiToolCatalogEntry> findByToolKey(String toolKey);

    boolean existsByToolKey(String toolKey);
}
