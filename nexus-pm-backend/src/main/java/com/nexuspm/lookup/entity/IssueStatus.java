package com.nexuspm.lookup.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "issue_status")
@Getter
@Setter
public class IssueStatus {

    @Id
    @Column(length = 36)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    @Column(nullable = false)
    private Integer sequence;

    @Column(nullable = false)
    private boolean terminal;

    @Column(length = 10)
    private String colour;
}
