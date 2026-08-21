package com.nexuspm.issue.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "rd_issue_quarterly_completion")
@Getter
@Setter
public class RdIssueQuarterlyCompletion extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "issue_id", nullable = false)
    private RdIssue issue;

    @Column(nullable = false)
    private Integer year;

    /** Calendar quarter 1–4. */
    @Column(nullable = false)
    private Integer quarter;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal percentage;

    @Column(nullable = false)
    private boolean deleted = false;

    @Version
    private long version;

    public String getDisplayKey() {
        return year + " Q" + quarter;
    }
}
