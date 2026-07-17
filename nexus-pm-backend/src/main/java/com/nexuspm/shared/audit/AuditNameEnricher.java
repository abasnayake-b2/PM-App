package com.nexuspm.shared.audit;

import com.nexuspm.shared.entity.AuditableEntity;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class AuditNameEnricher {

    private final EmployeeRepository employeeRepository;

    public <T extends AuditableEntity> T enrich(T entity) {
        if (entity != null) {
            enrichAll(java.util.List.of(entity));
        }
        return entity;
    }

    public <T extends AuditableEntity> java.util.List<T> enrichAll(java.util.List<T> entities) {
        if (entities == null || entities.isEmpty()) {
            return entities;
        }
        Set<UUID> ids = new HashSet<>();
        for (AuditableEntity entity : entities) {
            if (entity.getCreatedBy() != null) {
                ids.add(entity.getCreatedBy());
            }
            if (entity.getUpdatedBy() != null) {
                ids.add(entity.getUpdatedBy());
            }
        }
        Map<UUID, String> names = loadNames(ids);
        for (AuditableEntity entity : entities) {
            UUID createdBy = entity.getCreatedBy();
            UUID updatedBy = entity.getUpdatedBy();
            // Map.of() / immutable maps reject null keys — seed rows often have null audit ids
            entity.setCreatedByName(createdBy != null ? names.get(createdBy) : null);
            entity.setUpdatedByName(updatedBy != null ? names.get(updatedBy) : null);
        }
        return entities;
    }

    public Map<UUID, String> loadNames(Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return java.util.Collections.emptyMap();
        }
        return employeeRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(
                        e -> e.getId(),
                        e -> (e.getFirstName() + " " + e.getLastName()).trim(),
                        (a, b) -> a));
    }
}
