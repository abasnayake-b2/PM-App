package com.nexuspm.issue.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "rd_issue_note")
@Getter
@Setter
public class RdIssueNote extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "issue_id", nullable = false)
    private RdIssue issue;

    @Column(name = "note_date", nullable = false)
    private LocalDate noteDate;

    @Column(name = "note", columnDefinition = "TEXT", nullable = false)
    private String note;

    @Column(nullable = false, length = 120)
    private String owner;

    @Column(nullable = false)
    private boolean deleted = false;

    @Version
    private long version;
}
