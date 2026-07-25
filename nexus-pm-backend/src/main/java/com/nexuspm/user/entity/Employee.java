package com.nexuspm.user.entity;

import com.nexuspm.organisation.entity.Country;
import com.nexuspm.shared.entity.AuditableEntity;
import com.nexuspm.teamroster.entity.TeamImportBatch;
import com.nexuspm.teamroster.entity.TeamManagement;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "employee")
@Getter
@Setter
public class Employee extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @Column(unique = true)
    private String email;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "designation_id")
    private Designation designation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stream_id")
    private Stream stream;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_type_id")
    private WorkType workType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "country_id")
    private Country country;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "engineering_manager_management_id")
    private TeamManagement engineeringManagerManagement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_id")
    private Employee manager;

    @Column(length = 100)
    private String product;

    @Column(length = 50)
    private String phone;

    /** Filename under the configured Pic/ directory (e.g. {uuid}.jpg). */
    @Column(name = "profile_picture", length = 255)
    private String profilePicture;

    @Column(name = "total_years_of_experience", precision = 5, scale = 1)
    private BigDecimal totalYearsOfExperience;

    @Column(name = "experience_in_dfn", precision = 5, scale = 1)
    private BigDecimal experienceInDfn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "import_batch_id")
    private TeamImportBatch importBatch;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_management_id", unique = true)
    private TeamManagement teamManagement;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "bench_status", length = 20)
    private String benchStatus = "ASSIGNED";

    @Column(name = "available_from")
    private LocalDate availableFrom;

    /**
     * When true and the user is a Manager or VP, they see org-wide data.
     * CXO is always org-wide. Manager defaults false; VP defaults true.
     */
    @Column(name = "org_wide_visibility", nullable = false)
    private boolean orgWideVisibility = false;

    @Version
    @Column(name = "version")
    private Long version;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "employee_role",
            joinColumns = @JoinColumn(name = "employee_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new HashSet<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "employee_skill",
            joinColumns = @JoinColumn(name = "employee_id"),
            inverseJoinColumns = @JoinColumn(name = "skill_id")
    )
    private Set<Skill> skills = new HashSet<>();

    public String getFullName() {
        return firstName + " " + lastName;
    }

    public String getPrimaryRoleCode() {
        // Prefer org hierarchy roles when admin roles are combined with them.
        java.util.List<Role> orgRoles = roles.stream()
                .filter(r -> {
                    String code = r.getCode() != null ? r.getCode().toUpperCase() : "";
                    return !"SUPER_ADMIN".equals(code) && !"ADMIN".equals(code);
                })
                .toList();
        java.util.Collection<Role> pool = orgRoles.isEmpty() ? roles : orgRoles;
        return pool.stream()
                .min(Comparator.comparingInt(Employee::roleSortOrder))
                .map(Role::getCode)
                .orElse("EMPLOYEE");
    }

    private static int roleSortOrder(Role role) {
        if (role.getOrgLevel() != null) {
            return role.getOrgLevel().getLevelOrder();
        }
        return switch (role.getCode()) {
            case "SUPER_ADMIN" -> 0;
            case "ADMIN" -> 1;
            // Custom / unknown roles without org_level act as Employee — not senior to everyone.
            default -> 4;
        };
    }
}
