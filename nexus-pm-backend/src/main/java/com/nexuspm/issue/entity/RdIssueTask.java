package com.nexuspm.issue.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "rd_issue_task")
@Getter
@Setter
public class RdIssueTask extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "issue_id", nullable = false)
    private RdIssue issue;

    /** Sequence within the RD — shown as {RD key}-RT-{n}. */
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
