package com.nexuspm.release.entity;

import com.nexuspm.project.entity.Project;
import com.nexuspm.shared.entity.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "`release`")
@Getter
@Setter
public class Release extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 50)
    private String version;

    @Column(nullable = false, length = 20)
    private String status = "PLANNED";

    @Column(name = "target_date")
    private LocalDate targetDate;
}
