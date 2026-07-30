package com.nexuspm.release.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "release_risk")
@Getter
@Setter
public class ReleaseRisk extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "release_id", nullable = false)
    private Release release;

    @Column(name = "risk_number", nullable = false)
    private Integer riskNumber;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_date")
    private LocalDate createdDate;

    @Column(length = 120)
    private String owner;

    @Column(length = 40)
    private String status;

    @Column(length = 40)
    private String impact;

    @Column(name = "closed_date")
    private LocalDate closedDate;

    @Column(columnDefinition = "TEXT")
    private String mitigation;

    @Column(nullable = false)
    private boolean deleted = false;

    @Version
    private long version;

    public String getDisplayKey() {
        return "R" + riskNumber;
    }
}
