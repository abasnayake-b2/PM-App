package com.nexuspm.lookup.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "issue_type")
@Getter
@Setter
public class IssueType {

    @Id
    @Column(length = 36)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    @Column(name = "workflow_code", nullable = false, length = 30)
    private String workflowCode;

    @Column(length = 255)
    private String description;
}
