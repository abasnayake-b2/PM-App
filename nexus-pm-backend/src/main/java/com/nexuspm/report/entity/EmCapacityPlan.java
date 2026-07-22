package com.nexuspm.report.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import com.nexuspm.teamroster.entity.TeamManagement;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "em_capacity_plan")
@Getter
@Setter
public class EmCapacityPlan extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "em_management_id", nullable = false, unique = true)
    private TeamManagement engineeringManager;

    @Column(name = "additional_resources", nullable = false)
    private int additionalResources = 0;
}
