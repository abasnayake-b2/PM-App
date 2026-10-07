package com.nexuspm.lookup.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "task_type")
@Getter
@Setter
public class TaskType extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @Column(nullable = false, unique = true, length = 150)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;
}
