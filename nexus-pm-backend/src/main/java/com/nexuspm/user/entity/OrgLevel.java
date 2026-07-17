package com.nexuspm.user.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "org_level")
@Getter
@Setter
public class OrgLevel extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(name = "level_order", nullable = false, unique = true)
    private Integer levelOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reports_to_org_level_id")
    private OrgLevel reportsToOrgLevel;
}
