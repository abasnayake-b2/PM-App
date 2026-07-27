package com.nexuspm.ai.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ai_tool_catalog")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class AiToolCatalogEntry {

    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "tool_key", nullable = false, unique = true, length = 100)
    private String toolKey;

    @Column(name = "display_name", nullable = false, length = 150)
    private String displayName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "required_permission", length = 80)
    private String requiredPermission;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "updated_by", length = 36)
    private UUID updatedBy;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
