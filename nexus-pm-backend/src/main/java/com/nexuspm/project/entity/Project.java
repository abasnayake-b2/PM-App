package com.nexuspm.project.entity;

import com.nexuspm.organisation.entity.Client;
import com.nexuspm.shared.entity.AuditableEntity;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.user.entity.Employee;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "project")
@Getter
@Setter
public class Project extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 120)
    private String product;

    /** Optional Jira Cloud project key used for backlog sync (e.g. TEST). */
    @Column(name = "jira_project_key", length = 50)
    private String jiraProjectKey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_employee_id")
    private Employee leadEmployee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "architect_employee_id")
    private Employee architectEmployee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "engineering_manager_management_id")
    private TeamManagement engineeringManagerManagement;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "rag_status", length = 10)
    private String ragStatus = "GREEN";

    @Column(name = "progress_pct")
    private Integer progressPct = 0;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(nullable = false)
    private boolean archived = false;

    @Column(nullable = false)
    private boolean deleted = false;

    @Version
    @Column(name = "version")
    private Long version;
}
