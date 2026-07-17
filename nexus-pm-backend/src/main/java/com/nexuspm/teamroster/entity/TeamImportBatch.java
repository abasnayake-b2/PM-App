package com.nexuspm.teamroster.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import com.nexuspm.user.entity.Employee;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "team_import_batch")
@Getter
@Setter
public class TeamImportBatch extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "imported_by")
    private Employee importedBy;

    @Column(name = "management_count", nullable = false)
    private int managementCount;

    @Column(name = "member_count", nullable = false)
    private int memberCount;
}
