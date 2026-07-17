package com.nexuspm.lookup.repository;

import com.nexuspm.lookup.entity.Priority;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PriorityRepository extends JpaRepository<Priority, UUID> {

    List<Priority> findAllByOrderByLevelAsc();
}
