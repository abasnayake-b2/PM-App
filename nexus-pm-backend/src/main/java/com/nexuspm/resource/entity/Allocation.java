package com.nexuspm.resource.entity;

import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.entity.RdIssueTask;
import com.nexuspm.project.entity.Project;
import com.nexuspm.project.entity.ProjectTask;
import com.nexuspm.shared.entity.AuditableEntity;
import com.nexuspm.user.entity.Employee;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "allocation")
@Getter
@Setter
public class Allocation extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "issue_id")
    private RdIssue issue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_task_id")
    private ProjectTask projectTask;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rd_issue_task_id")
    private RdIssueTask rdIssueTask;

    @Column(name = "role_on_project", length = 50)
    private String roleOnProject;

    @Column(nullable = false)
    private Integer percentage;

    @Column(name = "from_date", nullable = false)
    private LocalDate fromDate;

    @Column(name = "to_date")
    private LocalDate toDate;

    @Column(nullable = false)
    private boolean billable = true;

    @Column(nullable = false)
    private boolean deleted = false;

    @Version
    private long version;
}
