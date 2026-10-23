package com.nexuspm.lookup.entity;

import com.nexuspm.teamroster.entity.TeamManagement;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(
        name = "work_category_director",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_work_category_director",
                columnNames = {"work_category_id", "director_management_id"}))
@Getter
@Setter
public class WorkCategoryDirector {

    @Id
    @Column(length = 36)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "work_category_id", nullable = false)
    private WorkCategory workCategory;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "director_management_id", nullable = false)
    private TeamManagement director;
}
