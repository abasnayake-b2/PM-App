package com.nexuspm.teamroster.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import com.nexuspm.user.entity.Employee;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "employee_manager_assignment")
@Getter
@Setter
public class EmployeeManagerAssignment extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "engineering_manager_management_id")
    private TeamManagement engineeringManager;

    @Column(name = "from_date", nullable = false)
    private LocalDate fromDate;

    @Column(name = "to_date")
    private LocalDate toDate;

    @Column(nullable = false, length = 20)
    private String source = "UI";
}
