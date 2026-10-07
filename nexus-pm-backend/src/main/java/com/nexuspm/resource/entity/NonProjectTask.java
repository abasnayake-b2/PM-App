package com.nexuspm.resource.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "non_project_task")
@Getter
@Setter
public class NonProjectTask extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(length = 120)
    private String module;

    @Column(nullable = false)
    private boolean deleted = false;

    @Version
    private long version;
}
