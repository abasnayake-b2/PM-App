package com.nexuspm.issue.field.entity;

import com.nexuspm.shared.entity.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "issue_field_definition")
@Getter
@Setter
public class IssueFieldDefinition extends AuditableEntity {

    @Id
    @Column(length = 36)
    private UUID id;

    @Column(name = "field_key", nullable = false, unique = true, length = 80)
    private String fieldKey;

    @Column(nullable = false, length = 120)
    private String label;

    @Column(name = "data_type", nullable = false, length = 20)
    private String dataType;

    @Column(name = "max_length")
    private Integer maxLength;

    @Column(nullable = false)
    private boolean required = false;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "system_field", nullable = false)
    private boolean systemField = false;

    @Column(name = "section_code", length = 40)
    private String sectionCode;

    @Column(name = "display_order", nullable = false)
    private int displayOrder = 0;

    @Column(name = "options_json", columnDefinition = "TEXT")
    private String optionsJson;

    @Column(name = "help_text", length = 255)
    private String helpText;
}
