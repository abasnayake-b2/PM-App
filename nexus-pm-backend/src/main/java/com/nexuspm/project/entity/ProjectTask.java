package com.nexuspm.project.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "project_task")
@Getter
@Setter
public class ProjectTask extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    /** Sequence within the project — shown as {project}-PT-{n}. */
    @Column(name = "task_number", nullable = false)
    private Integer taskNumber;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(length = 120)
    private String module;

    @Column(nullable = false)
    private boolean deleted = false;

    @Version
    private long version;
}
