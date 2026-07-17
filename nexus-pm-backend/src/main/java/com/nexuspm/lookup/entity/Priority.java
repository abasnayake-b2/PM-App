package com.nexuspm.lookup.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "priority")
@Getter
@Setter
public class Priority {

    @Id
    @Column(length = 36)
    private UUID id;

    @Column(nullable = false, unique = true, length = 30)
    private String label;

    @Column(nullable = false)
    private Integer level;

    @Column(name = "sla_response_hrs", nullable = false)
    private Integer slaResponseHrs;

    @Column(name = "sla_resolve_hrs", nullable = false)
    private Integer slaResolveHrs;

    @Column(length = 10)
    private String colour;
}
