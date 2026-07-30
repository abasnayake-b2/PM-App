package com.nexuspm.issue.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "rd_issue_risk")
@Getter
@Setter
public class RdIssueRisk extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "issue_id", nullable = false)
    private RdIssue issue;

    /** Sequence within the issue — shown as Risk ID (R1, R2, …). */
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
