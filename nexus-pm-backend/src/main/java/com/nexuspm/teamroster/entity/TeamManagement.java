package com.nexuspm.teamroster.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "team_management")
@Getter
@Setter
public class TeamManagement extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "role_title", nullable = false, length = 120)
    private String roleTitle;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supervisor_id")
    private TeamManagement supervisor;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "import_batch_id")
    private TeamImportBatch importBatch;

    public String getFullName() {
        return (firstName + " " + lastName).trim();
    }
}
