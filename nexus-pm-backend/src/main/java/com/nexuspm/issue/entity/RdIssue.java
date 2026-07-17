package com.nexuspm.issue.entity;

import com.nexuspm.lookup.entity.IssueStatus;
import com.nexuspm.lookup.entity.IssueType;
import com.nexuspm.lookup.entity.Priority;
import com.nexuspm.project.entity.Project;
import com.nexuspm.release.entity.Release;
import com.nexuspm.shared.entity.AuditableEntity;
import com.nexuspm.user.entity.Employee;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rd_issue")
@Getter
@Setter
public class RdIssue extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "release_id")
    private Release release;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_issue_id")
    private RdIssue parentIssue;

    /** Human key e.g. SABI-GBL-RD-1 or SABI-GBL-RD-1-TS-2. */
    @Column(name = "display_key", length = 120)
    private String displayKey;

    /** RD sequence within the project (shared by a parent and its descendants). */
    @Column(name = "rd_number")
    private Integer rdNumber;

    /** Sequence among siblings of the same type suffix under a parent (TS / ST / …). */
    @Column(name = "child_number")
    private Integer childNumber;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "issue_type_id", nullable = false)
    private IssueType issueType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "priority_id", nullable = false)
    private Priority priority;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "status_id", nullable = false)
    private IssueStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reported_by")
    private Employee reportedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to")
    private Employee assignedTo;

    @Column(name = "original_estimation", precision = 10, scale = 2)
    private BigDecimal originalEstimation;

    @Column(name = "actual_estimation", precision = 10, scale = 2)
    private BigDecimal actualEstimation;

    @Column(name = "capitalizable")
    private Boolean capitalizable;

    @Column(length = 100)
    private String component;

    @Column(name = "sla_due_at")
    private Instant slaDueAt;

    @Column(name = "sla_status", length = 20)
    private String slaStatus = "WITHIN";

    @Column(nullable = false)
    private boolean deleted = false;

    @Version
    private long version;
}
